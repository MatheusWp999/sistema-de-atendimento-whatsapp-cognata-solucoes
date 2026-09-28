import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, sanitizeCompany } from "@/lib/api";
import { allowedCompanyIds, getRequestAuth, requireCompanyAccess, unauthorized } from "@/services/api-auth.service";

const createAssistantSchema = z.object({
  companyId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  role: z.string().nullable().optional(),
  personality: z.string().trim().min(1),
  tone: z.string().nullable().optional(),
  greetingMessage: z.string().nullable().optional(),
  closingMessage: z.string().nullable().optional(),
  formalityLevel: z.number().int().min(1).max(5).optional(),
  friendlinessLevel: z.number().int().min(1).max(5).optional(),
  objectivityLevel: z.number().int().min(1).max(5).optional(),
  commercialLevel: z.number().int().min(1).max(5).optional(),
  detailLevel: z.number().int().min(1).max(5).optional(),
  responseSize: z.string().trim().min(1).optional(),
  useEmojis: z.boolean().optional(),
  temperature: z.number().optional(),
  maxTokens: z.number().int().positive().optional(),
  mandatoryRules: z.string().nullable().optional(),
  forbiddenRules: z.string().nullable().optional(),
  humanEscalationRules: z.string().nullable().optional(),
  fallbackMessage: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const auth = await getRequestAuth(request);
    if (!auth) return unauthorized();
    const companyIds = allowedCompanyIds(auth);
    if (companyIds && !companyIds.length) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    const assistants = await prisma.assistant.findMany({
      where: companyIds ? { companyId: { in: companyIds } } : undefined,
      include: { company: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(assistants.map((assistant) => ({
      ...assistant,
      company: sanitizeCompany(assistant.company),
    })));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = createAssistantSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(new Error(parsed.error.issues[0]?.message ?? "Dados invalidos"), 400);
    const body = parsed.data;
    const guard = await requireCompanyAccess(request, body.companyId);
    if (guard.response) return guard.response;
    const company = await prisma.company.findUnique({ where: { id: body.companyId }, select: { id: true } });
    if (!company) return apiError(new Error("Empresa nao encontrada"), 404);

    const assistant = await prisma.assistant.create({
      data: {
        companyId: body.companyId,
        name: body.name,
        role: body.role,
        personality: body.personality,
        tone: body.tone,
        greetingMessage: body.greetingMessage,
        closingMessage: body.closingMessage,
        formalityLevel: body.formalityLevel,
        friendlinessLevel: body.friendlinessLevel,
        objectivityLevel: body.objectivityLevel,
        commercialLevel: body.commercialLevel,
        detailLevel: body.detailLevel,
        responseSize: body.responseSize,
        useEmojis: body.useEmojis,
        temperature: body.temperature,
        maxTokens: body.maxTokens,
        mandatoryRules: body.mandatoryRules,
        forbiddenRules: body.forbiddenRules,
        humanEscalationRules: body.humanEscalationRules,
        fallbackMessage: body.fallbackMessage,
        enabled: body.enabled,
      },
    });
    return NextResponse.json(assistant, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
