import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { ConversationAIStatus, ConversationOwner } from "@/lib/constants";
import { requireCompanyAccess } from "@/services/api-auth.service";

const statusSchema = z.object({
  aiStatus: z.enum([
    ConversationAIStatus.AI_ACTIVE,
    ConversationAIStatus.HUMAN_TAKEOVER,
    ConversationAIStatus.AI_PAUSED_COMPANY,
    ConversationAIStatus.WAITING_HUMAN_REVIEW,
    ConversationAIStatus.AI_DISABLED,
  ]),
  currentOwner: z.enum([ConversationOwner.AI, ConversationOwner.HUMAN]),
}).refine((value) => {
  if (value.aiStatus === ConversationAIStatus.AI_ACTIVE) return value.currentOwner === ConversationOwner.AI;
  return value.currentOwner === ConversationOwner.HUMAN;
}, "Estado de IA e responsavel atual incompativeis.");

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const parsed = statusSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(new Error(parsed.error.issues[0]?.message ?? "Dados invalidos"), 400);
    const { aiStatus, currentOwner } = parsed.data;
    const existing = await prisma.conversation.findUnique({ where: { id }, select: { companyId: true } });
    if (!existing) return apiError(new Error("Conversa nao encontrada"), 404);
    const guard = await requireCompanyAccess(request, existing.companyId);
    if (guard.response) return guard.response;
    const conversation = await prisma.conversation.update({ where: { id }, data: { aiStatus, currentOwner, ownerEpoch: { increment: 1 } } });
    return NextResponse.json(conversation);
  } catch (error) {
    return apiError(error);
  }
}
