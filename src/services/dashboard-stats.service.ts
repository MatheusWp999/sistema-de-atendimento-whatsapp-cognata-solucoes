import { prisma } from "@/lib/db";

export async function getDashboardStats(companyId?: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const scoped = companyId ? { companyId } : {};

  const [companies, conversations, aiActive, human, waiting, aiToday, costDay, costMonth] = await Promise.all([
    companyId ? Promise.resolve(1) : prisma.company.count(),
    prisma.conversation.count({ where: scoped }),
    prisma.conversation.count({ where: { ...scoped, aiStatus: "AI_ACTIVE" } }),
    prisma.conversation.count({ where: { ...scoped, currentOwner: "HUMAN" } }),
    prisma.conversation.count({ where: { ...scoped, aiStatus: "WAITING_HUMAN_REVIEW" } }),
    prisma.aIUsageLog.count({ where: { ...scoped, requestType: "response", status: "success", createdAt: { gte: today } } }),
    prisma.aIUsageLog.aggregate({ where: { ...scoped, createdAt: { gte: today } }, _sum: { estimatedCost: true } }),
    prisma.aIUsageLog.aggregate({ where: { ...scoped, createdAt: { gte: monthStart } }, _sum: { estimatedCost: true } }),
  ]);

  return {
    companies,
    conversations,
    aiActive,
    human,
    waiting,
    aiToday,
    costDay: costDay._sum.estimatedCost ?? 0,
    costMonth: costMonth._sum.estimatedCost ?? 0,
  };
}
