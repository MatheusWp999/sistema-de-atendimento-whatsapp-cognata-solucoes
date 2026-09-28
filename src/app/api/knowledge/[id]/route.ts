import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, sanitizeCompany } from "@/lib/api";
import { clearCompanyAIKnowledgeContextCache } from "@/services/knowledge-context.service";
import { clearRagCache, processKnowledgeItem } from "@/services/rag.service";
import { requireCompanyAccess } from "@/services/api-auth.service";

const updateKnowledgeSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  type: z.string().trim().min(1).max(80).optional(),
  content: z.string().max(200_000).nullable().optional(),
  active: z.boolean().optional(),
}).strict();

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const item = await prisma.knowledgeItem.findUnique({ where: { id }, include: { company: true, chunks: true } });
    if (!item) return apiError(new Error("Conhecimento nao encontrado"), 404);
    const guard = await requireCompanyAccess(request, item.companyId);
    if (guard.response) return guard.response;
    return NextResponse.json({
      ...item,
      company: sanitizeCompany(item.company),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const parsed = updateKnowledgeSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(new Error(parsed.error.issues[0]?.message ?? "Dados invalidos"), 400);
    const body = parsed.data;
    const previous = await prisma.knowledgeItem.findUnique({ where: { id } });
    if (!previous) return apiError(new Error("Conhecimento nao encontrado"), 404);
    const guard = await requireCompanyAccess(request, previous.companyId);
    if (guard.response) return guard.response;
    const item = await prisma.knowledgeItem.update({
      where: { id },
      data: {
        title: body.title,
        type: body.type,
        content: body.content,
        active: body.active,
      },
    });
    clearRagCache();
    clearCompanyAIKnowledgeContextCache(item.companyId);
    const shouldReprocess = ["title", "type", "content"].some((key) => key in body);
    if (shouldReprocess) {
      const processed = await processKnowledgeItem(item.id);
      return NextResponse.json(processed ?? item);
    }
    return NextResponse.json(item);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const existing = await prisma.knowledgeItem.findUnique({ where: { id }, select: { id: true, companyId: true } });
    if (!existing) return apiError(new Error("Conhecimento nao encontrado"), 404);
    const guard = await requireCompanyAccess(request, existing.companyId);
    if (guard.response) return guard.response;

    const item = await prisma.knowledgeItem.delete({ where: { id } });
    clearRagCache();
    clearCompanyAIKnowledgeContextCache(item.companyId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
