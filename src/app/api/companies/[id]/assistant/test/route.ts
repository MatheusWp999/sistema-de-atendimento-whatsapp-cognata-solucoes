import type { Conversation } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { generateAssistantResponse } from "@/services/ai.service";
import { getCompanyAIKnowledgeContext } from "@/services/knowledge-context.service";
import { searchCompanyKnowledge } from "@/services/rag.service";
import { requireCompanyAccess } from "@/services/api-auth.service";

const testSchema = z.object({
  message: z.string().trim().min(1).max(1000).default("Ola, pode me ajudar?"),
}).strict();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const guard = await requireCompanyAccess(request, id);
    if (guard.response) return guard.response;
    const parsed = testSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return apiError(new Error(parsed.error.issues[0]?.message ?? "Mensagem invalida"), 400);

    const company = await prisma.company.findUnique({ where: { id }, include: { assistant: true } });
    if (!company?.assistant) return apiError(new Error("Empresa ou assistente nao encontrado"), 404);

    const now = new Date();
    const conversation: Conversation = {
      id: `dashboard-test-${id}`,
      companyId: id,
      customerName: "Cliente de teste",
      customerPhone: "teste-dashboard",
      aiStatus: "AI_ACTIVE",
      currentOwner: "AI",
      supportStatus: "OPEN",
      priority: "normal",
      assignedUserId: null,
      assignedAt: null,
      slaDueAt: null,
      ownerEpoch: 0,
      lastMessage: parsed.data.message,
      lastMessageAt: now,
      lastCustomerMessageAt: now,
      unreadCount: 0,
      lastReadAt: null,
      tags: [],
      internalNotes: null,
      aiSummary: null,
      createdAt: now,
      updatedAt: now,
    };

    const [retrievedKnowledge, companyKnowledgeContext] = await Promise.all([
      searchCompanyKnowledge({ companyId: id, question: parsed.data.message }),
      getCompanyAIKnowledgeContext(id),
    ]);

    const result = await generateAssistantResponse({
      company,
      assistant: company.assistant,
      conversation,
      customerMessage: parsed.data.message,
      history: [],
      retrievedKnowledge,
      companyKnowledgeContext,
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiError(error, 400);
  }
}
