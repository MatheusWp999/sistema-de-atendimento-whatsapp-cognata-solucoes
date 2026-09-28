import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { buildDefaultAssistantData } from "@/services/assistant-defaults.service";
import { hashPassword } from "@/services/password.service";
import { ACCOUNT_STATUS } from "@/services/account-approval.service";
import { checkRateLimit } from "@/services/rate-limit.service";
import { recordAuditEvent } from "@/services/audit.service";

const registerSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  ownerName: z.string().trim().min(2).max(120),
  ownerEmail: z.string().trim().email().max(180),
  ownerPassword: z.string().min(8).max(200),
  whatsappNumber: z.string().trim().max(40).optional().transform((value) => value || undefined),
}).strict();

export async function POST(request: Request) {
  try {
    const parsed = registerSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(new Error(parsed.error.issues[0]?.message ?? "Dados invalidos"), 400);

    const body = parsed.data;
    const email = body.ownerEmail.toLowerCase();
    const rateLimit = checkRateLimit(request, "auth:register", { limit: 5, windowMs: 60_000, key: email });
    if (!rateLimit.allowed) return NextResponse.json({ error: "Muitas tentativas. Aguarde antes de tentar novamente." }, { status: 429 });

    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) return apiError(new Error("Ja existe uma conta com este email."), 409);

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: body.companyName,
          whatsappNumber: body.whatsappNumber,
          accountStatus: ACCOUNT_STATUS.PENDING_APPROVAL,
          planKey: null,
          aiEnabled: false,
          assistant: { create: { ...buildDefaultAssistantData(body.companyName), enabled: false } },
        },
        select: { id: true, name: true, accountStatus: true, planKey: true },
      });

      const user = await tx.user.create({
        data: {
          name: body.ownerName,
          email,
          passwordHash: hashPassword(body.ownerPassword),
          role: "OWNER",
          memberships: { create: { companyId: company.id, role: "OWNER" } },
        },
        select: { id: true, name: true, email: true },
      });

      return { company, user };
    });

    await recordAuditEvent({
      request,
      actorType: "USER",
      actorId: result.user.id,
      action: "auth.registration_requested",
      entityType: "Company",
      entityId: result.company.id,
      companyId: result.company.id,
      metadata: { ownerEmail: result.user.email },
    });

    return NextResponse.json({ ok: true, status: "pending_approval", company: result.company }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
