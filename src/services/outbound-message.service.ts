import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { ConversationAIStatus, ConversationOwner, SenderType } from "@/lib/constants";
import { env } from "@/lib/env";
import type { MessageProvider } from "@/modules/providers/message-provider";

const MAX_DELIVERY_ATTEMPTS = 3;
const RETRYABLE_STATUSES = ["queued", "failed_retryable", "error"];
const STALE_SENDING_MS = 2 * 60_000;
const MAX_RETRY_BACKOFF_MS = 15 * 60_000;
const workerId = `${process.pid}-${randomUUID()}`;

function retryBackoffMs(attemptNumber: number) {
  return Math.min(30_000 * 2 ** Math.max(attemptNumber - 1, 0), MAX_RETRY_BACKOFF_MS);
}

function outboundContent(message: { content: string; metadata: unknown }) {
  const metadata = message.metadata;
  if (
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    "sentContent" in metadata &&
    typeof metadata.sentContent === "string"
  ) {
    return metadata.sentContent;
  }

  return message.content;
}

async function getOutboundProvider(): Promise<MessageProvider> {
  if (env.MESSAGE_PROVIDER === "whatsapp-cloud") {
    const { WhatsAppCloudProvider } = await import("@/modules/providers/whatsapp-cloud.provider");
    return new WhatsAppCloudProvider();
  }

  if (env.MESSAGE_PROVIDER === "whatsapp-qr") {
    const { WhatsAppQrProvider } = await import("@/modules/providers/whatsapp-qr.provider");
    return new WhatsAppQrProvider();
  }

  const { MockProvider } = await import("@/modules/providers/mock-provider");
  return new MockProvider();
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

export async function sendOutboundMessageNow(messageId: string, options?: { ignoreMaxAttempts?: boolean }) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { conversation: true },
  });

  if (!message) throw new Error("Mensagem de saída não encontrada.");
  if (message.externalId && message.status === "sent") return { messageId, status: "sent", externalId: message.externalId };
  if (message.status === "sending" && message.leaseExpiresAt && message.leaseExpiresAt.getTime() > Date.now()) {
    return { messageId, status: "sending" };
  }
  if (![SenderType.AI, SenderType.HUMAN].includes(message.senderType as typeof SenderType.AI | typeof SenderType.HUMAN)) {
    throw new Error("Apenas mensagens de IA ou humano podem ser enviadas pelo outbox.");
  }

  const now = new Date();
  const claimToken = randomUUID();
  const claimableStatuses = options?.ignoreMaxAttempts ? [...RETRYABLE_STATUSES, "failed_final"] : RETRYABLE_STATUSES;

  const claim = await prisma.message.updateMany({
    where: {
      id: messageId,
      externalId: null,
      OR: [
        { status: { in: claimableStatuses }, nextAttemptAt: null },
        { status: { in: claimableStatuses }, nextAttemptAt: { lte: now } },
        { status: "sending", leaseExpiresAt: { lt: now } },
        { status: "sending", leaseExpiresAt: null, claimedAt: { lt: new Date(Date.now() - STALE_SENDING_MS) } },
      ],
    },
    data: { status: "sending", claimedAt: now, claimedBy: workerId, claimToken, leaseExpiresAt: new Date(Date.now() + STALE_SENDING_MS) },
  });
  if (!claim.count) return { messageId, status: "skipped" };

  if (message.senderType === SenderType.AI) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: message.conversationId },
      select: { aiStatus: true, currentOwner: true },
    });

    if (conversation?.aiStatus !== ConversationAIStatus.AI_ACTIVE || conversation?.currentOwner !== ConversationOwner.AI) {
      await prisma.message.updateMany({
        where: { id: messageId, senderType: SenderType.AI, externalId: null, status: "sending", claimToken },
        data: { status: "canceled", claimedAt: null, claimedBy: null, claimToken: null, leaseExpiresAt: null, nextAttemptAt: null },
      });
      return { messageId, status: "skipped" };
    }
  }

  const previousAttempts = await prisma.messageDeliveryAttempt.count({ where: { messageId } });
  const attemptNumber = previousAttempts + 1;

  if (!options?.ignoreMaxAttempts && attemptNumber > MAX_DELIVERY_ATTEMPTS) {
    await prisma.message.updateMany({
      where: { id: messageId, status: "sending", claimToken },
      data: { status: "failed_final", claimedAt: null, claimedBy: null, claimToken: null, leaseExpiresAt: null, nextAttemptAt: null },
    });
    return { messageId, status: "failed_final" };
  }

  const attempt = await prisma.messageDeliveryAttempt.create({
    data: {
      messageId,
      conversationId: message.conversationId,
      companyId: message.companyId,
      provider: env.MESSAGE_PROVIDER,
      attemptNumber,
      status: "sending",
    },
  });

  try {
    const externalId = await (await getOutboundProvider()).sendMessage({
      companyId: message.companyId,
      conversationId: message.conversationId,
      to: message.conversation.customerPhone,
      message: outboundContent(message),
    });

    await prisma.messageDeliveryAttempt.update({
      where: { id: attempt.id },
      data: { status: "sent", externalId, finishedAt: new Date() },
    });
    const update = await prisma.message.updateMany({
      where: { id: messageId, status: "sending", claimToken },
      data: { status: "sent", claimedAt: null, claimedBy: null, claimToken: null, leaseExpiresAt: null, nextAttemptAt: null, externalId },
    });

    if (!update.count) return { messageId, status: "stale_claim", externalId };

    return { messageId, status: "sent", externalId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao enviar mensagem.";
    const retryable = attemptNumber < MAX_DELIVERY_ATTEMPTS;
    const status = retryable ? "failed_retryable" : "failed_final";
    const nextAttemptAt = retryable ? new Date(Date.now() + retryBackoffMs(attemptNumber)) : null;

    await prisma.messageDeliveryAttempt.update({
      where: { id: attempt.id },
      data: { status, errorMessage, finishedAt: new Date() },
    });
    const update = await prisma.message.updateMany({
      where: { id: messageId, status: "sending", claimToken },
      data: { status, claimedAt: null, claimedBy: null, claimToken: null, leaseExpiresAt: null, nextAttemptAt },
    });
    if (!update.count) return { messageId, status: "stale_claim", errorMessage };

    await addSystemEvent(
      message.conversationId,
      message.companyId,
      `Falha ao enviar mensagem pelo WhatsApp (${attemptNumber}/${MAX_DELIVERY_ATTEMPTS}). Status: ${status}. Erro: ${errorMessage}`,
    );

    return { messageId, status, errorMessage };
  }
}

export async function enqueueOutboundMessage(messageId: string, options?: { immediate?: boolean }) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      senderType: true,
      conversation: { select: { aiStatus: true, currentOwner: true } },
    },
  });

  if (!message) throw new Error("Mensagem de saída não encontrada.");
  if (
    message.senderType === SenderType.AI &&
    (message.conversation.aiStatus !== ConversationAIStatus.AI_ACTIVE || message.conversation.currentOwner !== ConversationOwner.AI)
  ) {
    await prisma.message.updateMany({
      where: { id: messageId, senderType: SenderType.AI, externalId: null, status: { in: ["queued", "failed_retryable", "sending"] } },
      data: { status: "canceled", claimedAt: null, claimedBy: null, claimToken: null, leaseExpiresAt: null, nextAttemptAt: null },
    });
    return { messageId, status: "skipped" };
  }

  await prisma.message.update({
    where: { id: messageId },
    data: { status: "queued", claimedAt: null, claimedBy: null, claimToken: null, leaseExpiresAt: null, nextAttemptAt: new Date() },
  });
  if (!options?.immediate) return { messageId, status: "queued" };
  return sendOutboundMessageNow(messageId);
}

export async function processPendingOutboundMessages(options?: { limit?: number; companyId?: string }) {
  await prisma.message.updateMany({
    where: {
      ...(options?.companyId ? { companyId: options.companyId } : {}),
      externalId: null,
      senderType: { in: [SenderType.AI, SenderType.HUMAN] },
      status: "sending",
      OR: [
        { leaseExpiresAt: { lt: new Date() } },
        { leaseExpiresAt: null, claimedAt: { lt: new Date(Date.now() - STALE_SENDING_MS) } },
        { leaseExpiresAt: null, claimedAt: null, createdAt: { lt: new Date(Date.now() - STALE_SENDING_MS) } },
      ],
    },
    data: { status: "failed_retryable", claimedAt: null, claimedBy: null, claimToken: null, leaseExpiresAt: null, nextAttemptAt: new Date() },
  });

  const messages = await prisma.message.findMany({
    where: {
      ...(options?.companyId ? { companyId: options.companyId } : {}),
      externalId: null,
      senderType: { in: [SenderType.AI, SenderType.HUMAN] },
      status: { in: RETRYABLE_STATUSES },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
    },
    orderBy: { createdAt: "asc" },
    take: options?.limit ?? 20,
  });

  const results = [];
  for (const message of messages) {
    results.push(await sendOutboundMessageNow(message.id));
  }

  return results;
}
