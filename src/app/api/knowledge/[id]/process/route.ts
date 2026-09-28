import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { processKnowledgeItem } from "@/services/rag.service";
import { requireCompanyAccess } from "@/services/api-auth.service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const existing = await prisma.knowledgeItem.findUnique({ where: { id }, select: { companyId: true } });
    if (!existing) return apiError(new Error("Conhecimento nao encontrado"), 404);
    const guard = await requireCompanyAccess(request, existing.companyId);
    if (guard.response) return guard.response;
    const item = await processKnowledgeItem(id);
    return NextResponse.json(item);
  } catch (error) {
    return apiError(error);
  }
}
