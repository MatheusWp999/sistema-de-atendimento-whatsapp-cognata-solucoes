import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, sanitizeCompanies } from "@/lib/api";
import { requireAdmin } from "@/services/api-auth.service";
import { buildDefaultAssistantData } from "@/services/assistant-defaults.service";
import { hashPassword } from "@/services/password.service";
import { recordAuditEvent } from "@/services/audit.service";
import { ACCOUNT_STATUS, isValidPlan } from "@/services/account-approval.service";

const createAccountSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  whatsappNumber: z.string().trim().max(40).optional().transform((value) => value || undefined),
  description: z.string().trim().max(2000).optional().transform((value) => value || undefined),
  ownerName: z.string().trim().min(2).max(120),
  ownerEmail: z.string().trim().email().max(180),
  ownerPassword: z.string().min(8).max(200),
  planKey: z.string().trim().optional().transform((value) => value || "PROFESSIONAL"),
}).strict();

function zodMessage(error: z.ZodError) {
  const issue = error.issues[0];
  const field = issue?.path.join(".");
  return field ? `${field}: ${issue.message}` : issue?.message ?? "Dados invalidos";
}

export async function GET(request: Request) {
  try {
    const guard = await requireAdmin(request);
    if (guard.response) return guard.response;

    const [companies, users, usage] = await Promise.all([
      prisma.company.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          assistant: true,
          memberships: { include: { user: { select: { id: true, name: true, email: true, role: true, active: true, lastLoginAt: true } } } },
          _count: { select: { conversations: true, knowledgeItems: true, usageLogs: true } },
        },
      }),
      prisma.user.count({ where: { active: true } }),
      prisma.aIUsageLog.aggregate({ _sum: { estimatedCost: true }, _count: { id: true } }),
    ]);

    return NextResponse.json({
      stats: {
        companies: companies.length,
        activeUsers: users,
        aiRequests: usage._count.id,
        estimatedCost: usage._sum.estimatedCost ?? 0,
      },
      companies: sanitizeCompanies(companies).map((company) => ({
        ...company,
        memberships: company.memberships.map((membership) => ({
          ...membership,
          user: {
            ...membership.user,
            lastLoginAt: membership.user.lastLoginAt?.toISOString() ?? null,
          },
        })),
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const guard = await requireAdmin(request);
    if (guard.response) return guard.response;

    const parsed = createAccountSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(new Error(zodMessage(parsed.error)), 400);
    const body = parsed.data;
    if (!isValidPlan(body.planKey)) return apiError(new Error("Plano invalido."), 400);
    const email = body.ownerEmail.toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) return apiError(new Error("Ja existe uma conta com este email."), 409);

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: body.companyName,
          whatsappNumber: body.whatsappNumber,
          description: body.description,
          accountStatus: ACCOUNT_STATUS.APPROVED,
          planKey: body.planKey,
          planApprovedAt: new Date(),
          aiEnabled: true,
          assistant: { create: buildDefaultAssistantData(body.companyName) },
        },
        include: { assistant: true },
      });

      const user = await tx.user.create({
        data: {
          name: body.ownerName,
          email,
          passwordHash: hashPassword(body.ownerPassword),
          role: "OWNER",
          memberships: { create: { companyId: company.id, role: "OWNER" } },
        },
        select: { id: true, name: true, email: true, role: true, active: true },
      });

      return { company, user };
    });

    await recordAuditEvent({
      request,
      action: "admin.company_account_created",
      entityType: "Company",
      entityId: result.company.id,
      companyId: result.company.id,
      metadata: { ownerEmail: result.user.email },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
