import { prisma } from "@/lib/db";
import { ConversationAIStatus, ConversationOwner, SenderType } from "@/lib/constants";
import type { IncomingMessageInput } from "@/types";
import type { Assistant, Company, Conversation } from "@prisma/client";
import { classifyMessageNeedHumanReview, generateAssistantResponse, shouldForceHumanReview } from "@/services/ai.service";
import { searchCompanyKnowledge } from "@/services/rag.service";
import { getCompanyAIKnowledgeContext } from "@/services/knowledge-context.service";
import { scheduleConversationSummary } from "@/services/conversation-summary.service";
import { getCompanyUsageStatus, pauseConversationByUsageLimit } from "@/services/usage.service";
import { enqueueOutboundMessage } from "@/services/outbound-message.service";
import { handleBusinessModules } from "@/modules/business-modules/business-module-orchestrator.service";
import { buildConversationAliases, normalizeConversationPhone, resolveConversationForCustomer } from "@/services/conversation-identity.service";
import { redactSensitiveContent } from "@/services/privacy.service";

const conversationResponseLocks = new Map<string, Promise<unknown>>();

async function withConversationResponseLock<T>(conversationId: string, run: () => Promise<T>) {
  const previous = conversationResponseLocks.get(conversationId) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(run);
  conversationResponseLocks.set(conversationId, current);
  try {
    return await current;
  } finally {
    if (conversationResponseLocks.get(conversationId) === current) conversationResponseLocks.delete(conversationId);
  }
}

async function addSystemEvent(conversationId: string, companyId: string, content: string) {
  return prisma.message.create({
    data: {
      conversationId,
      companyId,
      senderType: SenderType.SYSTEM,
      content,
      messageType: "system",
      origin: "system",
    },
  });
}

async function conversationAllowsAIResponse(conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { aiStatus: true, currentOwner: true },
  });

  return conversation?.aiStatus === ConversationAIStatus.AI_ACTIVE && conversation?.currentOwner === ConversationOwner.AI;
}

async function queueSafeHumanReviewMessage(input: { conversationId: string; companyId: string; category: string; reason?: string }) {
  const safeMessage =
    "Entendi. Para te passar essa informação com segurança, vou encaminhar sua conversa para um atendente responsável.";
  if (!(await conversationAllowsAIResponse(input.conversationId))) {
    return { conversationId: input.conversationId, responded: false };
  }
  await prisma.conversation.update({
    where: { id: input.conversationId },
    data: { aiStatus: ConversationAIStatus.WAITING_HUMAN_REVIEW, currentOwner: ConversationOwner.HUMAN },
  });
  const safeAiMessage = await prisma.message.create({
    data: {
      conversationId: input.conversationId,
      companyId: input.companyId,
      senderType: SenderType.AI,
      content: safeMessage,
      origin: "ai",
      status: "sending",
    },
  });
  await addSystemEvent(
    input.conversationId,
    input.companyId,
    input.reason ?? `Mensagem encaminhada para revisao humana. Categoria: ${input.category}`,
  );
  await enqueueOutboundMessage(safeAiMessage.id);
  return { conversationId: input.conversationId, responded: true };
}

async function respondToCustomerMessage(input: {
  company: Company & { assistant: Assistant | null };
  conversation: Conversation;
  conversationWithSummary: Conversation;
  customerMessage: string;
}) {
  const { company, conversation, conversationWithSummary, customerMessage } = input;

  if (!company.aiEnabled) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { aiStatus: ConversationAIStatus.AI_PAUSED_COMPANY, currentOwner: ConversationOwner.HUMAN },
    });
    await addSystemEvent(conversation.id, company.id, "IA geral da empresa pausada. Atendimento automatico bloqueado.");
    return { conversationId: conversation.id, responded: false };
  }

  if (!company.assistant?.enabled) {
    await addSystemEvent(conversation.id, company.id, "Atendente IA inativa para esta empresa.");
    return { conversationId: conversation.id, responded: false };
  }

  const category = classifyMessageNeedHumanReview(customerMessage);

  if (
    conversationWithSummary.aiStatus !== ConversationAIStatus.AI_ACTIVE ||
    conversationWithSummary.currentOwner !== ConversationOwner.AI
  ) {
    return { conversationId: conversation.id, responded: false };
  }

  const usage = await getCompanyUsageStatus(company.id);
  if (!usage.allowed) {
    await pauseConversationByUsageLimit(conversation.id, usage.reason ?? "Limite atingido");
    return { conversationId: conversation.id, responded: false };
  }

  const shouldTryModuleBeforeHumanReview = category === "CANCELLATION";
  if (!shouldTryModuleBeforeHumanReview && shouldForceHumanReview(category)) {
    return queueSafeHumanReviewMessage({ conversationId: conversation.id, companyId: company.id, category });
  }

  const moduleResult = await handleBusinessModules({ company, conversation, customerMessage });
  if (moduleResult.handled && moduleResult.content) {
    if (!(await conversationAllowsAIResponse(conversation.id))) {
      return { conversationId: conversation.id, responded: false };
    }

    const moduleAiMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        companyId: company.id,
        senderType: SenderType.AI,
        content: moduleResult.content,
        origin: "ai_module",
        status: "sending",
        metadata: {
          generated: false,
          moduleHandled: true,
          ...(moduleResult.metadata ?? {}),
        },
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessage: moduleResult.content,
        lastMessageAt: moduleAiMessage.createdAt,
        ...(moduleResult.needsHumanReview
          ? { aiStatus: ConversationAIStatus.WAITING_HUMAN_REVIEW, currentOwner: ConversationOwner.HUMAN }
          : {}),
      },
    });

    await enqueueOutboundMessage(moduleAiMessage.id);
    await scheduleConversationSummary(conversation.id).catch(() => undefined);
    return { conversationId: conversation.id, responded: true, moduleHandled: true };
  }

  if (shouldTryModuleBeforeHumanReview && shouldForceHumanReview(category)) {
    return queueSafeHumanReviewMessage({ conversationId: conversation.id, companyId: company.id, category });
  }

  let history;
  let retrievedKnowledge;
  let companyKnowledgeContext;
  try {
    [history, retrievedKnowledge, companyKnowledgeContext] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }).then((messages) => messages.reverse()),
      searchCompanyKnowledge({ companyId: company.id, question: customerMessage }),
      getCompanyAIKnowledgeContext(company.id),
    ]);
  } catch (error) {
    return queueSafeHumanReviewMessage({
      conversationId: conversation.id,
      companyId: company.id,
      category: "KNOWLEDGE_CONTEXT_ERROR",
      reason: `Falha ao carregar historico, RAG ou contexto permanente da IA. Erro: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
    });
  }

  const response = await generateAssistantResponse({
    company,
    assistant: company.assistant,
    conversation: conversationWithSummary,
    customerMessage,
    history,
    retrievedKnowledge,
    companyKnowledgeContext,
  }).catch(async (error) => {
    const message = "A IA encontrou um erro ao tentar responder. Vou encaminhar sua conversa para um atendente responsável.";
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { aiStatus: ConversationAIStatus.WAITING_HUMAN_REVIEW, currentOwner: ConversationOwner.HUMAN },
    });
    await addSystemEvent(
      conversation.id,
      company.id,
      `Falha ao gerar resposta da IA. Verifique chave, modelo, saldo ou permissao do provedor. Erro: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
    );
    return { content: message, generated: false, needsHumanReview: true };
  });
  const retrievedKnowledgeTitles = retrievedKnowledge
    .map((item) => item.title)
    .filter((title): title is string => Boolean(title));

  if (!(await conversationAllowsAIResponse(conversation.id))) {
    return { conversationId: conversation.id, responded: false };
  }

  const aiMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      companyId: company.id,
      senderType: SenderType.AI,
      content: response.content,
      origin: "ai",
      status: "sending",
      metadata: {
        retrievedKnowledge: retrievedKnowledgeTitles,
        generated: response.generated,
        needsHumanReview: response.needsHumanReview,
      },
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessage: response.content,
      lastMessageAt: aiMessage.createdAt,
      ...(response.needsHumanReview
        ? { aiStatus: ConversationAIStatus.WAITING_HUMAN_REVIEW, currentOwner: ConversationOwner.HUMAN }
        : {}),
    },
  });

  if (response.needsHumanReview) {
    await addSystemEvent(
      conversation.id,
      company.id,
      "IA encaminhou para revisao humana por falta de informacao explicita suficiente no conhecimento/treinamento da empresa.",
    );
  }

  await enqueueOutboundMessage(aiMessage.id);

  await scheduleConversationSummary(conversation.id).catch(() => undefined);

  return { conversationId: conversation.id, responded: true };
}

export async function handleIncomingMessage(input: IncomingMessageInput) {
  const redactedIncomingMessage = redactSensitiveContent(input.message);
  const company = await prisma.company.findFirst({
    where: input.companyId ? { id: input.companyId } : { whatsappNumber: input.companyWhatsappNumber },
    include: { assistant: true },
  });

  if (!company) throw new Error("Empresa nao encontrada para a mensagem recebida.");

  if (input.externalId) {
    const existingMessage = await prisma.message.findUnique({
      where: { externalId: input.externalId },
      select: { conversationId: true },
    });
    if (existingMessage) {
      return { conversationId: existingMessage.conversationId, responded: false, duplicate: true };
    }
  }

  const normalizedFrom = normalizeConversationPhone(input.from);
  const conversation = await resolveConversationForCustomer({
    companyId: company.id,
    customerPhone: normalizedFrom,
    aliases: buildConversationAliases(normalizedFrom, input.contactAliases),
    customerName: input.customerName,
    defaults: {
      aiStatus: ConversationAIStatus.AI_ACTIVE,
      currentOwner: ConversationOwner.AI,
    },
  });

  const customerMessage = await prisma.message.create({
    data: {
      externalId: input.externalId,
      conversationId: conversation.id,
      companyId: company.id,
      senderType: SenderType.CUSTOMER,
      content: redactedIncomingMessage,
      status: "received",
      origin: "whatsapp",
    },
  });

  const updatedConversation = await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      ...(input.customerName ? { customerName: input.customerName } : {}),
      lastMessage: redactedIncomingMessage,
      lastMessageAt: customerMessage.createdAt,
      lastCustomerMessageAt: customerMessage.createdAt,
      unreadCount: { increment: 1 },
    },
  });

  await scheduleConversationSummary(conversation.id).catch(() => undefined);
  const conversationWithSummary = updatedConversation;

  return withConversationResponseLock(conversation.id, () => respondToCustomerMessage({
    company,
    conversation,
    conversationWithSummary,
    customerMessage: redactedIncomingMessage,
  }));
}

export async function respondToLatestUnansweredCustomerMessage(conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { company: { include: { assistant: true } } },
  });
  if (!conversation) throw new Error("Conversa nao encontrada");

  const latestCustomerMessage = await prisma.message.findFirst({
    where: { conversationId, senderType: SenderType.CUSTOMER },
    orderBy: { createdAt: "desc" },
  });
  if (!latestCustomerMessage) return { conversationId, responded: false, reason: "no_customer_message" };

  const latestOutboundMessage = await prisma.message.findFirst({
    where: { conversationId, senderType: { in: [SenderType.AI, SenderType.HUMAN] } },
    orderBy: { createdAt: "desc" },
  });
  if (latestOutboundMessage && latestOutboundMessage.createdAt > latestCustomerMessage.createdAt) {
    return { conversationId, responded: false, reason: "already_answered" };
  }

  await scheduleConversationSummary(conversationId).catch(() => undefined);
  const conversationWithSummary = conversation;

  return withConversationResponseLock(conversation.id, () => respondToCustomerMessage({
    company: conversation.company,
    conversation,
    conversationWithSummary,
    customerMessage: latestCustomerMessage.content,
  }));
}
