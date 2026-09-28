import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, sanitizeCompany } from "@/lib/api";
import { recordAuditEvent } from "@/services/audit.service";
import { requireCompanyAccess } from "@/services/api-auth.service";

const aiStatusSchema = z.object({
  aiEnabled: z.boolean(),
  resumeCompanyPausedConversations: z.boolean().optional(),
}).strict();

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const guard = await requireCompanyAccess(request, id);
    if (guard.response) return guard.response;
    const parsed = aiStatusSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(new Error(parsed.error.issues[0]?.message ?? "Dados invalidos"), 400);
    const { aiEnabled, resumeCompanyPausedConversations } = parsed.data;

    const existing = await prisma.company.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return apiError(new Error("Empresa nao encontrada"), 404);

    const company = await prisma.company.update({ where: { id }, data: { aiEnabled } });
    if (!aiEnabled) {
      await prisma.conversation.updateMany({
        where: { companyId: id, currentOwner: "AI" },
        data: { aiStatus: "AI_PAUSED_COMPANY", currentOwner: "HUMAN", ownerEpoch: { increment: 1 } },
      });
    } else if (resumeCompanyPausedConversations) {
      await prisma.conversation.updateMany({
        where: { companyId: id, aiStatus: "AI_PAUSED_COMPANY" },
        data: { aiStatus: "AI_ACTIVE", currentOwner: "AI", ownerEpoch: { increment: 1 } },
      });
    }
    await recordAuditEvent({ request, companyId: id, action: aiEnabled ? "company_ai.enabled" : "company_ai.disabled", entityType: "Company", entityId: id });
    return NextResponse.json(sanitizeCompany(company));
  } catch (error) {
    return apiError(error);
  }
}
