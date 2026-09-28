import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, sanitizeCompany } from "@/lib/api";
import { processKnowledgeItem } from "@/services/rag.service";
import { allowedCompanyIds, getRequestAuth, requireCompanyAccess, scopedCompanyId, unauthorized } from "@/services/api-auth.service";

const createKnowledgeSchema = z.object({
  companyId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(160),
  type: z.string().trim().min(1).max(80),
  content: z.string().max(200_000).nullable().optional(),
  active: z.boolean().optional(),
  sourceType: z.string().optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const auth = await getRequestAuth(request);
    if (!auth) return unauthorized();
    const companyId = scopedCompanyId(auth, searchParams.get("companyId") ?? undefined);
    if (companyId === null) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    const companyIds = allowedCompanyIds(auth);
    if (companyIds && !companyIds.length) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    const items = await prisma.knowledgeItem.findMany({
      where: companyId ? { companyId } : companyIds ? { companyId: { in: companyIds } } : {},
      include: { company: true, _count: { select: { chunks: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(items.map((item) => ({
      ...item,
      company: sanitizeCompany(item.company),
    })));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = createKnowledgeSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(new Error(parsed.error.issues[0]?.message ?? "Dados invalidos"), 400);
    const body = parsed.data;
    const guard = await requireCompanyAccess(request, body.companyId);
    if (guard.response) return guard.response;
    const company = await prisma.company.findUnique({ where: { id: body.companyId }, select: { id: true } });
    if (!company) return apiError(new Error("Empresa nao encontrada"), 404);

    const item = await prisma.knowledgeItem.create({
      data: {
        companyId: body.companyId,
        title: body.title,
        type: body.type,
        content: body.content,
        active: body.active,
        sourceType: body.type === "Treinamento" ? "training" : "manual",
      },
    });
    await processKnowledgeItem(item.id);
    const processed = await prisma.knowledgeItem.findUnique({ where: { id: item.id }, include: { chunks: true } });
    return NextResponse.json(processed, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
