import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { requireAdmin } from "@/services/api-auth.service";
import { ACCOUNT_STATUS, isValidPlan } from "@/services/account-approval.service";
import { recordAuditEvent } from "@/services/audit.service";

const updateSchema = z.object({
  accountStatus: z.enum([ACCOUNT_STATUS.APPROVED, ACCOUNT_STATUS.PENDING_APPROVAL, ACCOUNT_STATUS.SUSPENDED]).optional(),
  planKey: z.string().nullable().optional(),
}).strict();

function zodMessage(error: z.ZodError) {
  const issue = error.issues[0];
  const field = issue?.path.join(".");
  return field ? `${field}: ${issue.message}` : issue?.message ?? "Dados invalidos";
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const guard = await requireAdmin(request);
    if (guard.response) return guard.response;

    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(new Error(zodMessage(parsed.error)), 400);
    const body = parsed.data;
    if (typeof body.accountStatus === "undefined" && typeof body.planKey === "undefined") {
      return apiError(new Error("Informe status da conta ou plano para atualizar."), 400);
    }
    if (body.planKey && !isValidPlan(body.planKey)) return apiError(new Error("Plano invalido."), 400);

    const currentCompany = await prisma.company.findUnique({ where: { id }, select: { accountStatus: true, planKey: true } });
    if (!currentCompany) return apiError(new Error("Empresa nao encontrada."), 404);

    const nextStatus = body.accountStatus ?? currentCompany.accountStatus;
    const nextPlanKey = typeof body.planKey !== "undefined" ? body.planKey : currentCompany.planKey;
    if (nextStatus === ACCOUNT_STATUS.APPROVED && !nextPlanKey) {
      return apiError(new Error("Empresa aprovada precisa ter um plano valido."), 400);
    }
    const released = nextStatus === ACCOUNT_STATUS.APPROVED && Boolean(nextPlanKey);
    const company = await prisma.company.update({
      where: { id },
      data: {
        accountStatus: nextStatus,
        planKey: nextPlanKey,
        aiEnabled: released,
        ...(released ? { accountStatus: ACCOUNT_STATUS.APPROVED, planApprovedAt: new Date() } : {}),
        ...(nextStatus === ACCOUNT_STATUS.SUSPENDED ? { aiEnabled: false } : {}),
      },
      select: { id: true, name: true, accountStatus: true, planKey: true },
    });

    await recordAuditEvent({
      request,
      action: "admin.company_plan_updated",
      entityType: "Company",
      entityId: company.id,
      companyId: company.id,
      metadata: { accountStatus: company.accountStatus, planKey: company.planKey },
    });

    return NextResponse.json({ ok: true, company });
  } catch (error) {
    return apiError(error);
  }
}
