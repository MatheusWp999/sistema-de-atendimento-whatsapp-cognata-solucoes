import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ADMIN_AUTH_COOKIE, TENANT_AUTH_COOKIE, verifyAdminSession, verifyTenantSessionCookie } from "@/services/tenant-session.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const adminSession = verifyAdminSession(cookieStore.get(ADMIN_AUTH_COOKIE)?.value);
  if (adminSession) {
    return NextResponse.json({ type: "admin", name: adminSession.name ?? "Administrador", email: adminSession.email ?? null, companies: [] });
  }

  const session = verifyTenantSessionCookie(cookieStore.get(TENANT_AUTH_COOKIE)?.value);
  if (!session) return NextResponse.json({ type: "anonymous" }, { status: 401 });

  const memberships = await prisma.companyMembership.findMany({
    where: { userId: session.userId, companyId: { in: session.companyIds } },
    include: { company: { select: { id: true, name: true, accountStatus: true, planKey: true } } },
    orderBy: { company: { name: "asc" } },
  });

  return NextResponse.json({
    type: "company_user",
    id: session.userId,
    name: session.name,
    email: session.email,
    role: session.role,
    activeCompanyId: session.companyId,
    companies: memberships.map((membership) => ({
      id: membership.companyId,
      name: membership.company.name,
      role: membership.role,
      accountStatus: membership.company.accountStatus,
      planKey: membership.company.planKey,
    })),
  });
}
