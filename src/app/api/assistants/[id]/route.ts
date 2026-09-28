import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, sanitizeCompany } from "@/lib/api";
import { requireCompanyAccess } from "@/services/api-auth.service";

const updateAssistantSchema = z.object({
  name: z.string().trim().min(1).optional(),
  role: z.string().nullable().optional(),
  personality: z.string().trim().min(1).optional(),
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

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const assistant = await prisma.assistant.findUnique({ where: { id }, include: { company: true } });
    if (!assistant) return apiError(new Error("Atendente IA nao encontrada"), 404);
    const guard = await requireCompanyAccess(_request, assistant.companyId);
    if (guard.response) return guard.response;
    return NextResponse.json({
      ...assistant,
      company: sanitizeCompany(assistant.company),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const parsed = updateAssistantSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(new Error(parsed.error.issues[0]?.message ?? "Dados invalidos"), 400);
    const body = parsed.data;
    const existing = await prisma.assistant.findUnique({ where: { id }, select: { id: true, companyId: true } });
    if (!existing) return apiError(new Error("Atendente IA nao encontrada"), 404);
    const guard = await requireCompanyAccess(request, existing.companyId);
    if (guard.response) return guard.response;

    const assistant = await prisma.assistant.update({
      where: { id },
      data: {
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
    return NextResponse.json(assistant);
  } catch (error) {
    return apiError(error);
  }
}
