import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { processKnowledgeItem } from "@/services/rag.service";
import { requireCompanyAccess } from "@/services/api-auth.service";

const generalInfoSchema = z.object({
  name: z.string().trim().min(1).max(120),
  businessType: z.string().trim().min(1).max(120),
  descriptionTitle: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(10_000),
  alwaysOpen: z.boolean(),
  continueAfterHours: z.boolean(),
});

function buildKnowledgeContent(input: z.infer<typeof generalInfoSchema>) {
  return [
    `Nome da empresa: ${input.name}`,
    `Tipo de empresa: ${input.businessType}`,
    `Titulo da descricao: ${input.descriptionTitle}`,
    `Descricao da empresa: ${input.description}`,
    `Funcionamento 24h: ${input.alwaysOpen ? "sim" : "nao"}`,
    `Fora do horario de atendimento: ${input.continueAfterHours ? "continuar atendendo normalmente" : "informar apenas que a empresa esta fechada"}`,
  ].join("\n");
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const guard = await requireCompanyAccess(request, id);
    if (guard.response) return guard.response;
    const parsed = generalInfoSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(new Error(parsed.error.issues[0]?.message ?? "Dados invalidos"), 400);
    const body = parsed.data;

    const company = await prisma.company.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        notes: body.businessType,
        businessHours: {
          businessType: body.businessType,
          descriptionTitle: body.descriptionTitle,
          alwaysOpen: body.alwaysOpen,
          continueAfterHours: body.continueAfterHours,
        } as Prisma.InputJsonValue,
      },
    });

    const content = buildKnowledgeContent(body);
    const existing = await prisma.knowledgeItem.findFirst({
      where: { companyId: id, type: "Informacoes da empresa", sourceType: "general-info-form" },
      orderBy: { updatedAt: "desc" },
    });

    const knowledgeItem = existing
      ? await prisma.knowledgeItem.update({
        where: { id: existing.id },
        data: { title: body.descriptionTitle, content, active: true, processed: false },
      })
      : await prisma.knowledgeItem.create({
        data: {
          companyId: id,
          title: body.descriptionTitle,
          type: "Informacoes da empresa",
          sourceType: "general-info-form",
          content,
          active: true,
        },
      });

    await processKnowledgeItem(knowledgeItem.id);

    return NextResponse.json({ company, knowledgeItemId: knowledgeItem.id });
  } catch (error) {
    return apiError(error);
  }
}
