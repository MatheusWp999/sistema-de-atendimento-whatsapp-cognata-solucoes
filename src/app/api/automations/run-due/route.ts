import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { requireCompanyAccess } from "@/services/api-auth.service";
import { enqueueOutboundMessage } from "@/services/outbound-message.service";
import { SenderType } from "@/lib/constants";

function automationMessage(payload: unknown) {
  if (payload && typeof payload === "object" && !Array.isArray(payload) && "message" in payload && typeof payload.message === "string") {
    return payload.message;
  }
  return "Oi! Passando para saber se voce ainda precisa de ajuda por aqui.";
}

export async function POST(request: Request) {
  try {
    const { companyId } = await request.json() as { companyId?: string };
    if (!companyId) return apiError(new Error("Empresa obrigatoria."), 400);
    const guard = await requireCompanyAccess(request, companyId);
    if (guard.response) return guard.response;
    const rules = await prisma.automationRule.findMany({ where: { companyId, enabled: true } });
    let created = 0;

    for (const rule of rules) {
      const staleBefore = new Date(Date.now() - rule.delayMinutes * 60_000);
      const conversations = await prisma.conversation.findMany({
        where: {
          companyId,
          supportStatus: rule.triggerKey === "WAITING_HUMAN_REVIEW" ? undefined : "OPEN",
          aiStatus: rule.triggerKey === "WAITING_HUMAN_REVIEW" ? "WAITING_HUMAN_REVIEW" : undefined,
          lastMessageAt: { lte: staleBefore },
        },
        take: 25,
      });

      for (const conversation of conversations) {
        const existing = await prisma.automationRun.findFirst({
          where: { ruleId: rule.id, conversationId: conversation.id, createdAt: { gte: conversation.lastMessageAt ?? conversation.createdAt } },
        });
        if (existing) continue;
        const content = automationMessage(rule.actionPayload);
        const message = await prisma.message.create({
          data: { conversationId: conversation.id, companyId, senderType: SenderType.HUMAN, content, origin: "automation", status: "queued", metadata: { automationRuleId: rule.id, sentContent: content } },
        });
        await enqueueOutboundMessage(message.id, { immediate: true });
        await prisma.automationRun.create({ data: { companyId, ruleId: rule.id, conversationId: conversation.id, status: "SENT", message: content } });
        created += 1;
      }
      await prisma.automationRule.update({ where: { id: rule.id }, data: { lastRunAt: new Date() } });
    }

    return NextResponse.json({ created });
  } catch (error) {
    return apiError(error);
  }
}
