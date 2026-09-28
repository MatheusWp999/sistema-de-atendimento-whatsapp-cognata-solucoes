import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { env } from "@/lib/env";
import { handleIncomingMessage } from "@/services/message-orchestrator.service";
import { requireCompanyAccess } from "@/services/api-auth.service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { content } = await request.json();
    if (env.ENABLE_CHAT_TEST_TOOLS !== "true") return apiError(new Error("Simulacao indisponivel neste ambiente"), 404);
    if (typeof content !== "string" || !content.trim() || content.length > 4000) return apiError(new Error("Mensagem invalida"), 400);
    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation) return apiError(new Error("Conversa nao encontrada"), 404);
    const guard = await requireCompanyAccess(request, conversation.companyId);
    if (guard.response) return guard.response;
    const result = await handleIncomingMessage({
      companyId: conversation.companyId,
      from: conversation.customerPhone,
      customerName: conversation.customerName ?? undefined,
      message: content.trim(),
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
