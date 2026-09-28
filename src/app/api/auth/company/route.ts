import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { verifyPassword } from "@/services/password.service";
import { ADMIN_AUTH_COOKIE, createAdminSessionCookie, createTenantSessionCookie, shouldUseSecureCookies, TENANT_AUTH_COOKIE } from "@/services/tenant-session.service";
import { recordAuditEvent } from "@/services/audit.service";
import { checkRateLimit } from "@/services/rate-limit.service";
import { isCompanyReleased } from "@/services/account-approval.service";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(200),
  companyId: z.string().optional(),
}).strict();

function serializeCompany(company: { id: string; name: string; accountStatus: string; planKey: string | null }, role: string) {
  return { id: company.id, name: company.name, role, accountStatus: company.accountStatus, planKey: company.planKey };
}

function isPlatformAdmin(role: string) {
  return role === "PLATFORM_ADMIN" || role === "SUPER_ADMIN";
}

export async function POST(request: Request) {
  try {
    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(new Error(parsed.error.issues[0]?.message ?? "Dados invalidos"), 400);
    const rateLimit = checkRateLimit(request, "auth:company", { limit: 8, windowMs: 60_000, key: parsed.data.email.toLowerCase() });
    if (!rateLimit.allowed) return NextResponse.json({ error: "Muitas tentativas. Aguarde antes de tentar novamente." }, { status: 429 });

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
      include: { memberships: { include: { company: { select: { id: true, name: true, accountStatus: true, planKey: true } } } } },
    });

    if (!user?.active || !verifyPassword(parsed.data.password, user.passwordHash)) {
      return apiError(new Error("Email ou senha invalidos."), 401);
    }

    if (isPlatformAdmin(user.role)) {
      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      await recordAuditEvent({ request, actorType: "USER", actorId: user.id, action: "auth.admin_login", entityType: "User", entityId: user.id });
      const response = NextResponse.json({
        ok: true,
        type: "admin",
        redirectTo: "/admin",
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        companies: [],
      });
      response.cookies.set(ADMIN_AUTH_COOKIE, createAdminSessionCookie({ userId: user.id, email: user.email, name: user.name }), {
        httpOnly: true,
        sameSite: "strict",
        secure: shouldUseSecureCookies(request),
        path: "/",
        maxAge: 60 * 60 * 8,
      });
      response.cookies.set(TENANT_AUTH_COOKIE, "", { path: "/", maxAge: 0 });
      return response;
    }

    const memberships = user.memberships;
    if (!memberships.length) return apiError(new Error("Usuario sem empresa vinculada."), 403);

    const selectedMembership = parsed.data.companyId
      ? memberships.find((membership) => membership.companyId === parsed.data.companyId)
      : memberships[0];
    if (!selectedMembership) return apiError(new Error("Usuario sem acesso a esta empresa."), 403);
    const released = isCompanyReleased(selectedMembership.company);

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await recordAuditEvent({
      request,
      actorType: "USER",
      actorId: user.id,
      companyId: selectedMembership.companyId,
      action: "auth.company_login",
      entityType: "User",
      entityId: user.id,
    });

    const response = NextResponse.json({
      ok: true,
      redirectTo: released ? "/dashboard" : "/aguarde-liberacao",
      accountStatus: selectedMembership.company.accountStatus,
      planKey: selectedMembership.company.planKey,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      activeCompanyId: selectedMembership.companyId,
      companies: memberships.map((membership) => serializeCompany(membership.company, membership.role)),
    });
    response.cookies.set(TENANT_AUTH_COOKIE, createTenantSessionCookie({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: selectedMembership.role,
      companyId: selectedMembership.companyId,
      companyIds: memberships.map((membership) => membership.companyId),
      accountStatus: selectedMembership.company.accountStatus,
      planKey: selectedMembership.company.planKey,
    }), {
      httpOnly: true,
      sameSite: "strict",
      secure: shouldUseSecureCookies(request),
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    response.cookies.set(ADMIN_AUTH_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(TENANT_AUTH_COOKIE, "", { path: "/", maxAge: 0 });
  response.cookies.set(ADMIN_AUTH_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
