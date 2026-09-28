import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { requireCompanyAccess } from "@/services/api-auth.service";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const existing = await prisma.conversation.findUnique({ where: { id }, select: { companyId: true } });
    if (!existing) return apiError(new Error("Conversa nao encontrada"), 404);
    const guard = await requireCompanyAccess(request, existing.companyId);
    if (guard.response) return guard.response;
    const conversation = await prisma.conversation.update({
      where: { id },
      data: { aiStatus: "HUMAN_TAKEOVER", currentOwner: "HUMAN" },
    });
    await prisma.message.updateMany({
      where: {
        conversationId: id,
        senderType: "AI",
        externalId: null,
        status: { in: ["queued", "failed_retryable", "sending"] },
      },
      data: { status: "canceled", claimedAt: null, claimedBy: null, claimToken: null, leaseExpiresAt: null, nextAttemptAt: null },
    });
    await prisma.message.create({
      data: {
        companyId: conversation.companyId,
        conversationId: id,
        senderType: "SYSTEM",
        content: "Humano assumiu o atendimento.",
        messageType: "system",
        origin: "system",
      },
    });
    return NextResponse.json(conversation);
  } catch (error) {
    return apiError(error);
  }
}
