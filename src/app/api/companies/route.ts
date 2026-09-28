import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { apiError, sanitizeCompanies, sanitizeCompany } from "@/lib/api";
import { allowedCompanyIds, getRequestAuth, requireAdmin, unauthorized } from "@/services/api-auth.service";

export const dynamic = "force-dynamic";

const createCompanySchema = z.object({
  name: z.string().trim().min(1),
  whatsappNumber: z.string().trim().nullable().optional(),
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

export async function GET(request: Request) {
  try {
    const auth = await getRequestAuth(request);
    if (!auth) return unauthorized();
    const companyIds = allowedCompanyIds(auth);
    if (companyIds && !companyIds.length) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

    const companies = await prisma.company.findMany({
      where: companyIds ? { id: { in: companyIds } } : undefined,
      orderBy: { name: "asc" },
      include: { assistant: true, _count: { select: { conversations: true, knowledgeItems: true } } },
    });
    const trainingCounts = await prisma.knowledgeItem.groupBy({
      by: ["companyId"],
      where: { type: "Treinamento", ...(companyIds ? { companyId: { in: companyIds } } : {}) },
      _count: { id: true },
    });
    const trainingsByCompany = new Map(trainingCounts.map((item) => [item.companyId, item._count.id]));

    return NextResponse.json(sanitizeCompanies(companies).map((company) => ({
      ...company,
      trainingCount: trainingsByCompany.get(company.id) ?? 0,
    })));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const guard = await requireAdmin(request);
    if (guard.response) return guard.response;
    const parsed = createCompanySchema.safeParse(await request.json());
    if (!parsed.success) return apiError(new Error(parsed.error.issues[0]?.message ?? "Dados invalidos"), 400);
    const body = parsed.data;
    const company = await prisma.company.create({
      data: {
        name: body.name,
        whatsappNumber: body.whatsappNumber,
        description: body.description,
        notes: body.notes,
        aiEnabled: body.aiEnabled,
        aiProvider: body.aiProvider,
        defaultAiModel: body.defaultAiModel,
        fallbackAiModel: body.fallbackAiModel,
        embeddingModel: body.embeddingModel,
        openRouterModel: body.openRouterModel,
        dailyMessageLimit: body.dailyMessageLimit,
        monthlyMessageLimit: body.monthlyMessageLimit,
        dailyCostLimit: body.dailyCostLimit,
        monthlyCostLimit: body.monthlyCostLimit,
        ...(typeof body.businessHours !== "undefined" ? { businessHours: JSON.parse(JSON.stringify(body.businessHours)) as Prisma.InputJsonValue } : {}),
      },
    });
    return NextResponse.json(sanitizeCompany(company), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
