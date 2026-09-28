import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { buildDefaultAssistantData } from "@/services/assistant-defaults.service";
import { recordAuditEvent } from "@/services/audit.service";
import { requireCompanyAccess } from "@/services/api-auth.service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const guard = await requireCompanyAccess(request, id);
    if (guard.response) return guard.response;
    const company = await prisma.company.findUnique({ where: { id }, include: { assistant: true } });
    if (!company) return apiError(new Error("Empresa nao encontrada"), 404);

    const assistantData = buildDefaultAssistantData(company.name);
    const assistant = company.assistant
      ? await prisma.assistant.update({ where: { id: company.assistant.id }, data: assistantData })
      : await prisma.assistant.create({ data: { ...assistantData, companyId: id } });

    await prisma.knowledgeItem.updateMany({
      where: { companyId: id, sourceType: "agent-persona-form", type: "Identidade e persona da IA" },
      data: { active: false },
    });
    await recordAuditEvent({ request, companyId: id, action: "assistant.reset", entityType: "Assistant", entityId: assistant.id });
    return NextResponse.json({ assistant });
  } catch (error) {
    return apiError(error);
  }
}
