import { randomUUID } from "crypto";
import type { Company, Conversation, Message } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveAIConfig } from "@/modules/ai/ai-provider.factory";
import { estimateOpenAICost, logAIUsage } from "@/services/usage.service";

const MIN_MESSAGES_TO_SUMMARIZE = 6;
const RECENT_MESSAGES_FOR_SUMMARY = 30;
const MAX_SUMMARY_ATTEMPTS = 3;
const SUMMARY_LEASE_MS = 5 * 60_000;
const workerId = `${process.pid}-${randomUUID()}`;

function formatMessageForSummary(message: Message) {
  const label =
    message.senderType === "CUSTOMER"
      ? "Cliente"
      : message.senderType === "AI"
        ? "IA"
        : message.senderType === "HUMAN"
          ? "Humano"
          : "Sistema";

  return `${label}: ${message.content}`;
}

function buildSummaryPrompt(input: {
  company: Company;
  conversation: Conversation;
  messages: Message[];
}) {
  const history = input.messages.map(formatMessageForSummary).join("\n");

  return `Atualize o resumo operacional desta conversa de WhatsApp.

EMPRESA: ${input.company.name}
CLIENTE: ${input.conversation.customerName ?? "Nao identificado"} (${input.conversation.customerPhone})

RESUMO ANTERIOR:
${input.conversation.aiSummary || "Sem resumo anterior."}

MENSAGENS RECENTES:
${history}

Gere um resumo curto e util para uma atendente continuar o atendimento sem perder contexto.

Inclua, quando existir:
- quem e o cliente;
- o que ele quer;
- dados ja coletados;
- duvidas, objeções ou preocupacoes;
- combinados e proximos passos;
- se houve humano no atendimento;
- pontos sensiveis ou limites;
- informacoes que a IA nao deve esquecer.

Regras:
- Responda em portugues do Brasil.
- Nao invente dados.
- Seja objetivo.
- Nao ultrapasse 1800 caracteres.`;
}

function buildFallbackSummary(conversation: Conversation, messages: Message[]) {
  const latest = messages.slice(-12).map(formatMessageForSummary).join("\n");
  const summary = [
    conversation.aiSummary ? `Resumo anterior: ${conversation.aiSummary}` : "",
    `Ultimas interacoes:\n${latest}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return summary.length > 1800 ? `${summary.slice(0, 1800)}...` : summary;
}

export async function refreshConversationSummary(conversationId: string, options?: { force?: boolean }) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { company: true },
  });
  if (!conversation) return null;

  const totalMessages = await prisma.message.count({ where: { conversationId } });
  if (!options?.force && totalMessages < MIN_MESSAGES_TO_SUMMARIZE) {
    return conversation;
  }

  if (!options?.force && totalMessages % MIN_MESSAGES_TO_SUMMARIZE !== 0 && conversation.aiSummary) {
    return conversation;
  }

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: RECENT_MESSAGES_FOR_SUMMARY,
  }).then((items) => items.reverse());

  const config = await resolveAIConfig(conversation.company);
  let summary = "";

  if (!config.apiKey) {
    summary = buildFallbackSummary(conversation, messages);
  } else {
    const prompt = buildSummaryPrompt({ company: conversation.company, conversation, messages });
    try {
      const result = await config.provider.generateResponse({
        apiKey: config.apiKey,
        model: config.model,
        prompt,
        temperature: 0.2,
        maxTokens: 500,
      });
      summary = result.content;
      await logAIUsage({
        companyId: conversation.companyId,
        conversationId,
        provider: config.providerName,
        model: result.model,
        embeddingModel: config.embeddingModel,
        usedCompanyKey: config.usedCompanyKey,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.totalTokens,
        estimatedCost: config.providerName === "openai" ? estimateOpenAICost(result.model, result.inputTokens, result.outputTokens) : 0,
        requestType: "summary",
        status: "success",
      });
    } catch (error) {
      await logAIUsage({
        companyId: conversation.companyId,
        conversationId,
        provider: config.providerName,
        model: config.model,
        embeddingModel: config.embeddingModel,
        usedCompanyKey: config.usedCompanyKey,
        requestType: "summary",
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Erro desconhecido ao resumir conversa",
      });
      summary = buildFallbackSummary(conversation, messages);
    }
  }

  return prisma.conversation.update({
    where: { id: conversationId },
    data: { aiSummary: summary },
  });
}

export async function scheduleConversationSummary(conversationId: string, options?: { force?: boolean }) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { id: true, companyId: true } });
  if (!conversation) return null;

  const existing = await prisma.conversationSummaryJob.findFirst({
    where: { conversationId, status: { in: ["queued", "processing"] } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    return prisma.conversationSummaryJob.update({
      where: { id: existing.id },
      data: { force: existing.force || Boolean(options?.force), scheduledAt: new Date(), errorMessage: null },
    });
  }

  return prisma.conversationSummaryJob.create({
    data: {
      conversationId,
      companyId: conversation.companyId,
      force: Boolean(options?.force),
      status: "queued",
    },
  });
}

export async function processPendingConversationSummaries(options?: { limit?: number }) {
  await prisma.conversationSummaryJob.updateMany({
    where: { status: "processing", leaseExpiresAt: { lt: new Date() }, attempts: { lt: MAX_SUMMARY_ATTEMPTS } },
    data: { status: "failed_retryable", lockedBy: null, leaseExpiresAt: null },
  });

  const jobs = await prisma.conversationSummaryJob.findMany({
    where: {
      status: { in: ["queued", "failed_retryable"] },
      scheduledAt: { lte: new Date() },
      attempts: { lt: MAX_SUMMARY_ATTEMPTS },
    },
    orderBy: { scheduledAt: "asc" },
    take: options?.limit ?? 10,
  });

  const results = [];
  for (const job of jobs) {
    const claim = await prisma.conversationSummaryJob.updateMany({
      where: { id: job.id, status: { in: ["queued", "failed_retryable"] } },
      data: {
        status: "processing",
        startedAt: new Date(),
        attempts: { increment: 1 },
        lockedBy: workerId,
        leaseExpiresAt: new Date(Date.now() + SUMMARY_LEASE_MS),
      },
    });
    if (!claim.count) continue;

    try {
      await refreshConversationSummary(job.conversationId, { force: job.force });
      const update = await prisma.conversationSummaryJob.updateMany({
        where: { id: job.id, status: "processing", lockedBy: workerId },
        data: { status: "completed", finishedAt: new Date(), errorMessage: null, lockedBy: null, leaseExpiresAt: null },
      });
      if (!update.count) {
        results.push({ jobId: job.id, conversationId: job.conversationId, status: "stale_claim" });
        continue;
      }
      results.push({ jobId: job.id, conversationId: job.conversationId, status: "completed" });
    } catch (error) {
      const nextAttempts = job.attempts + 1;
      const final = nextAttempts >= MAX_SUMMARY_ATTEMPTS;
      await prisma.conversationSummaryJob.updateMany({
        where: { id: job.id, status: "processing", lockedBy: workerId },
        data: {
          status: final ? "failed_final" : "failed_retryable",
          errorMessage: error instanceof Error ? error.message : "Erro desconhecido ao resumir conversa",
          scheduledAt: new Date(Date.now() + Math.min(60_000, 5_000 * nextAttempts)),
          finishedAt: new Date(),
          lockedBy: null,
          leaseExpiresAt: null,
        },
      });
      results.push({ jobId: job.id, conversationId: job.conversationId, status: final ? "failed_final" : "failed_retryable" });
    }
  }
  return results;
}
