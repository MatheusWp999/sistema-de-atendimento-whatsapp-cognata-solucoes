import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { env } from "@/lib/env";
import { scheduleConversationSummary } from "@/services/conversation-summary.service";
import { enqueueOutboundMessage } from "@/services/outbound-message.service";
import { redactSensitiveContent } from "@/services/privacy.service";
import { recordAuditEvent } from "@/services/audit.service";
import { requireCompanyAccess } from "@/services/api-auth.service";

function formatHumanWhatsAppMessage(content: string) {
  const header = `${env.OPERATOR_DISPLAY_NAME} | ${env.OPERATOR_ROLE}`.trim();
  return `${header}\n${content}`;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const conversation = await prisma.conversation.findUnique({ where: { id }, select: { companyId: true } });
    if (!conversation) return apiError(new Error("Conversa nao encontrada"), 404);
    const guard = await requireCompanyAccess(request, conversation.companyId);
    if (guard.response) return guard.response;
    const messages = await prisma.message.findMany({ where: { conversationId: id }, orderBy: { createdAt: "asc" } });
    return NextResponse.json(messages);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { content } = await request.json();
    const cleanContent = String(content ?? "").trim();
    if (!cleanContent) return apiError(new Error("Mensagem obrigatoria"), 400);
    if (cleanContent.length > 4000) return apiError(new Error("Mensagem deve ter ate 4000 caracteres"), 400);
    const safeContent = redactSensitiveContent(cleanContent);

    const conversation = await prisma.conversation.findUnique({ where: { id }, include: { company: true } });
    if (!conversation) return apiError(new Error("Conversa nao encontrada"), 404);
    const guard = await requireCompanyAccess(request, conversation.companyId);
    if (guard.response) return guard.response;
    if (conversation.company.aiEnabled && conversation.aiStatus === "AI_ACTIVE" && conversation.currentOwner === "AI") {
      return apiError(new Error("A IA esta ativa nesta conversa. Assuma o atendimento antes de enviar manualmente."), 409);
    }
    const formattedContent = formatHumanWhatsAppMessage(safeContent);
    const message = await prisma.message.create({
      data: {
        conversationId: id,
        companyId: conversation.companyId,
        senderType: "HUMAN",
        content: safeContent,
        origin: "operator",
        status: "sending",
        metadata: {
          operatorName: env.OPERATOR_DISPLAY_NAME,
          operatorRole: env.OPERATOR_ROLE,
          sentContent: formattedContent,
        },
      },
    });

    await enqueueOutboundMessage(message.id);

    await prisma.conversation.update({ where: { id }, data: { lastMessage: safeContent, lastMessageAt: message.createdAt } });
    await recordAuditEvent({ request, companyId: conversation.companyId, action: "message.human_sent", entityType: "Message", entityId: message.id });
    await scheduleConversationSummary(id, { force: true }).catch(() => undefined);
    const updatedMessage = await prisma.message.findUnique({ where: { id: message.id } });
    return NextResponse.json(updatedMessage ?? message, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
