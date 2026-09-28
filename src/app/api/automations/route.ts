import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { allowedCompanyIds, getRequestAuth, requireCompanyAccess, scopedCompanyId, unauthorized } from "@/services/api-auth.service";

const automationSchema = z.object({
  companyId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(120),
  triggerKey: z.enum(["INACTIVE_OPEN_CONVERSATION", "WAITING_HUMAN_REVIEW"]).default("INACTIVE_OPEN_CONVERSATION"),
  enabled: z.boolean().default(true),
  delayMinutes: z.number().int().min(1).max(10080).default(60),
  message: z.string().trim().min(3).max(2000),
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
    const rules = await prisma.automationRule.findMany({
      where: companyId ? { companyId } : allowedIds ? { companyId: { in: allowedIds } } : undefined,
      include: { _count: { select: { runs: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(rules);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = automationSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(new Error(zodMessage(parsed.error)), 400);
    const body = parsed.data;
    const guard = await requireCompanyAccess(request, body.companyId);
    if (guard.response) return guard.response;
    const rule = await prisma.automationRule.create({
      data: {
        companyId: body.companyId,
        name: body.name,
        triggerKey: body.triggerKey,
        enabled: body.enabled,
        delayMinutes: body.delayMinutes,
        actionPayload: { message: body.message } as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
