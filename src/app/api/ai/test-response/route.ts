import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { generateAssistantResponse } from "@/services/ai.service";
import { searchCompanyKnowledge } from "@/services/rag.service";
import { getCompanyAIKnowledgeContext } from "@/services/knowledge-context.service";
import { requireCompanyAccess } from "@/services/api-auth.service";

export async function POST(request: Request) {
  let conversationId: string | undefined;
  try {
    const { companyId, message } = await request.json();
    if (typeof companyId !== "string" || typeof message !== "string" || message.length > 1000) return apiError(new Error("Dados invalidos"), 400);
    const guard = await requireCompanyAccess(request, companyId);
    if (guard.response) return guard.response;
    const company = await prisma.company.findUnique({ where: { id: companyId }, include: { assistant: true } });
    if (!company?.assistant) return apiError(new Error("Empresa ou IA nao encontrada"), 404);
    const conversation = await prisma.conversation.create({
      data: { companyId, customerPhone: "teste-local", customerName: "Teste local" },
    });
    conversationId = conversation.id;
    const [retrievedKnowledge, companyKnowledgeContext] = await Promise.all([
      searchCompanyKnowledge({ companyId, question: message }),
      getCompanyAIKnowledgeContext(companyId),
    ]);
    const response = await generateAssistantResponse({
      company,
      assistant: company.assistant,
      conversation,
      customerMessage: message,
      history: [],
      retrievedKnowledge,
      companyKnowledgeContext,
    });
    return NextResponse.json(response);
  } catch (error) {
    return apiError(error);
  } finally {
    if (conversationId) await prisma.conversation.delete({ where: { id: conversationId } }).catch(() => undefined);
  }
}
