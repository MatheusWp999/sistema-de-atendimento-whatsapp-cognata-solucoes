import { prisma } from "@/lib/db";
import { ConversationAIStatus } from "@/lib/constants";

function startOfDay() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfMonth() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function estimateOpenAICost(model: string, inputTokens = 0, outputTokens = 0) {
  const lowerModel = model.toLowerCase();
  const pricing = lowerModel.includes("gpt-4o-mini")
    ? { input: 0.00000015, output: 0.0000006 }
    : { input: 0.000005, output: 0.000015 };
  return inputTokens * pricing.input + outputTokens * pricing.output;
}

export async function logAIUsage(input: {
  companyId: string;
  conversationId?: string;
  provider?: string;
  model: string;
  embeddingModel?: string;
  usedCompanyKey?: boolean;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  requestType: string;
  status: "success" | "error";
  errorMessage?: string;
}) {
  return prisma.aIUsageLog.create({
    data: {
      provider: "openai",
      ...input,
    },
  });
}

export async function getCompanyUsageStatus(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return { allowed: false, reason: "Empresa nao encontrada" };

  const [dailyMessages, monthlyMessages, dailyCost, monthlyCost] = await Promise.all([
    prisma.aIUsageLog.count({
      where: { companyId, requestType: "response", status: "success", createdAt: { gte: startOfDay() } },
    }),
    prisma.aIUsageLog.count({
      where: { companyId, requestType: "response", status: "success", createdAt: { gte: startOfMonth() } },
    }),
    prisma.aIUsageLog.aggregate({
      where: { companyId, status: "success", createdAt: { gte: startOfDay() } },
      _sum: { estimatedCost: true },
    }),
    prisma.aIUsageLog.aggregate({
      where: { companyId, status: "success", createdAt: { gte: startOfMonth() } },
      _sum: { estimatedCost: true },
    }),
  ]);

  if (company.dailyMessageLimit && dailyMessages >= company.dailyMessageLimit) {
    return { allowed: false, reason: "Limite diario de mensagens atingido" };
  }
  if (company.monthlyMessageLimit && monthlyMessages >= company.monthlyMessageLimit) {
    return { allowed: false, reason: "Limite mensal de mensagens atingido" };
  }
  if (company.dailyCostLimit && (dailyCost._sum.estimatedCost ?? 0) >= company.dailyCostLimit) {
    return { allowed: false, reason: "Limite diario de custo atingido" };
  }
  if (company.monthlyCostLimit && (monthlyCost._sum.estimatedCost ?? 0) >= company.monthlyCostLimit) {
    return { allowed: false, reason: "Limite mensal de custo atingido" };
  }

  return { allowed: true, reason: null };
}

export async function pauseConversationByUsageLimit(conversationId: string, reason: string) {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { aiStatus: ConversationAIStatus.WAITING_HUMAN_REVIEW, currentOwner: "HUMAN" },
  });

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) return;

  await prisma.message.create({
    data: {
      companyId: conversation.companyId,
      conversationId,
      senderType: "SYSTEM",
      content: `Limite de uso da IA atingido para esta empresa. Atendimento automatico pausado. ${reason}`,
      messageType: "system",
      origin: "system",
    },
  });
}

export async function getUsageDashboard(filters?: { companyId?: string; companyIds?: string[]; from?: Date; to?: Date }) {
  const where = {
    ...(filters?.companyId ? { companyId: filters.companyId } : filters?.companyIds ? { companyId: { in: filters.companyIds } } : {}),
    ...(filters?.from || filters?.to
      ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
      : {}),
  };

  const [logs, byCompany, byModel] = await Promise.all([
    prisma.aIUsageLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { company: { select: { id: true, name: true } } },
    }),
    prisma.aIUsageLog.groupBy({
      by: ["companyId"],
      where,
      _sum: { inputTokens: true, outputTokens: true, totalTokens: true, estimatedCost: true },
      _count: { id: true },
    }),
    prisma.aIUsageLog.groupBy({
      by: ["model"],
      where,
      _sum: { inputTokens: true, outputTokens: true, totalTokens: true, estimatedCost: true },
      _count: { id: true },
    }),
  ]);

  const companies = await prisma.company.findMany({
    where: filters?.companyId ? { id: filters.companyId } : filters?.companyIds ? { id: { in: filters.companyIds } } : undefined,
    select: { id: true, name: true, dailyCostLimit: true, monthlyCostLimit: true },
  });
  return { logs, byCompany, byModel, companies };
}
