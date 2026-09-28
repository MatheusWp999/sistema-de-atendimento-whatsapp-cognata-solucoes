import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { apiError, sanitizeCompany } from "@/lib/api";
import { requireAdmin, requireCompanyAccess } from "@/services/api-auth.service";

const updateCompanySchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().nullable().optional(),
  businessHours: z.unknown().optional(),
  notes: z.string().nullable().optional(),
  aiEnabled: z.boolean().optional(),
  aiProvider: z.enum(["openai", "openrouter"]).optional(),
  defaultAiModel: z.string().trim().nullable().optional(),
  fallbackAiModel: z.string().trim().nullable().optional(),
  embeddingModel: z.string().trim().nullable().optional(),
  openRouterModel: z.string().trim().nullable().optional(),
  dailyMessageLimit: z.number().int().positive().nullable().optional(),
  monthlyMessageLimit: z.number().int().positive().nullable().optional(),
  dailyCostLimit: z.number().positive().nullable().optional(),
  monthlyCostLimit: z.number().positive().nullable().optional(),
}).strict();

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const guard = await requireCompanyAccess(request, id);
    if (guard.response) return guard.response;
    const company = await prisma.company.findUnique({ where: { id }, include: { assistant: true } });
    if (!company) return apiError(new Error("Empresa nao encontrada"), 404);
    return NextResponse.json(sanitizeCompany(company));
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const guard = await requireCompanyAccess(request, id);
    if (guard.response) return guard.response;
    const parsed = updateCompanySchema.safeParse(await request.json());
    if (!parsed.success) return apiError(new Error(parsed.error.issues[0]?.message ?? "Dados invalidos"), 400);
    const body = parsed.data;
    const { businessHours, ...rest } = body;
    const data: Prisma.CompanyUpdateInput = {
      ...rest,
      ...(typeof businessHours !== "undefined" ? { businessHours: JSON.parse(JSON.stringify(businessHours)) as Prisma.InputJsonValue } : {}),
    };
    const company = await prisma.company.update({ where: { id }, data });
    return NextResponse.json(sanitizeCompany(company));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const guard = await requireAdmin(request);
    if (guard.response) return guard.response;
    const { confirmationName } = await request.json();
    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) return apiError(new Error("Empresa nao encontrada"), 404);
    if (confirmationName !== company.name) {
      return apiError(new Error("Nome de confirmacao diferente do nome da empresa."), 400);
    }

    await prisma.company.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
