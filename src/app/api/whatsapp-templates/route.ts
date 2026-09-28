import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { allowedCompanyIds, getRequestAuth, requireCompanyAccess, scopedCompanyId, unauthorized } from "@/services/api-auth.service";

const templateSchema = z.object({
  companyId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(80),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).default("MARKETING"),
  language: z.string().trim().min(2).max(12).default("pt_BR"),
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"]).default("DRAFT"),
  body: z.string().trim().min(3).max(2000),
  variables: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  providerTemplateId: z.string().trim().max(120).nullable().optional(),
}).strict();

function zodMessage(error: z.ZodError) {
  const issue = error.issues[0];
  const field = issue?.path.join(".");
  return field ? `${field}: ${issue.message}` : issue?.message ?? "Dados invalidos";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const auth = await getRequestAuth(request);
    if (!auth) return unauthorized();
    const companyId = scopedCompanyId(auth, searchParams.get("companyId"));
    if (companyId === null) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    const allowedIds = allowedCompanyIds(auth);
    const templates = await prisma.whatsAppTemplate.findMany({
      where: companyId ? { companyId } : allowedIds ? { companyId: { in: allowedIds } } : undefined,
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(templates);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = templateSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(new Error(zodMessage(parsed.error)), 400);
    const body = parsed.data;
    const guard = await requireCompanyAccess(request, body.companyId);
    if (guard.response) return guard.response;
    const template = await prisma.whatsAppTemplate.create({ data: body });
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
