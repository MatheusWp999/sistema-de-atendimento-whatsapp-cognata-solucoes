import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { respondToLatestUnansweredCustomerMessage } from "@/services/message-orchestrator.service";
import { requireCompanyAccess } from "@/services/api-auth.service";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const existing = await prisma.conversation.findUnique({ where: { id }, include: { company: true } });
    if (!existing) return apiError(new Error("Conversa nao encontrada"), 404);
    const guard = await requireCompanyAccess(request, existing.companyId);
    if (guard.response) return guard.response;
    if (!existing.company.aiEnabled) return apiError(new Error("IA geral da empresa esta pausada"), 409);
    const conversation = await prisma.conversation.update({
      where: { id },
      data: { aiStatus: "AI_ACTIVE", currentOwner: "AI" },
    });
    await prisma.message.create({
      data: {
        companyId: conversation.companyId,
        conversationId: id,
        senderType: "SYSTEM",
        content: "Conversa devolvida para IA.",
        messageType: "system",
        origin: "system",
      },
    });
    const response = await respondToLatestUnansweredCustomerMessage(id).catch((error) => ({
      responded: false,
      error: error instanceof Error ? error.message : "Erro ao responder mensagem pendente",
    }));
    return NextResponse.json({ ...conversation, pendingResponse: response });
  } catch (error) {
    return apiError(error);
  }
}
