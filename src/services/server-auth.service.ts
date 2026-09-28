import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { isCompanyReleased } from "@/services/account-approval.service";
import { ADMIN_AUTH_COOKIE, isAdminCookieAuthorized, TENANT_AUTH_COOKIE, verifyTenantSessionCookie, type TenantSession } from "@/services/tenant-session.service";

export type CurrentAuth =
  | { type: "admin" }
  | { type: "company_user"; session: TenantSession }
  | { type: "anonymous" };

export async function getCurrentAuth(): Promise<CurrentAuth> {
  const cookieStore = await cookies();
  if (isAdminCookieAuthorized(cookieStore.get(ADMIN_AUTH_COOKIE)?.value)) return { type: "admin" };
  const session = verifyTenantSessionCookie(cookieStore.get(TENANT_AUTH_COOKIE)?.value);
  return session ? { type: "company_user", session } : { type: "anonymous" };
}

export function companyScopeFromAuth(auth: CurrentAuth, requestedCompanyId?: string) {
  if (auth.type === "admin") return requestedCompanyId;
  if (auth.type !== "company_user") return "__unauthorized__";
  if (requestedCompanyId && !auth.session.companyIds.includes(requestedCompanyId)) return "__unauthorized__";
  if (requestedCompanyId) return requestedCompanyId;
  return auth.session.companyId;
}

export async function companyScopeFromReleasedAuth(auth: CurrentAuth, requestedCompanyId?: string) {
  const companyId = companyScopeFromAuth(auth, requestedCompanyId);
  if (companyId === "__unauthorized__") return companyId;
  if (auth.type !== "company_user") return companyId;
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { accountStatus: true, planKey: true } });
  return company && isCompanyReleased(company) ? companyId : "__unauthorized__";
}

export async function getCompanyReleaseState(auth: CurrentAuth) {
  if (auth.type !== "company_user") return { released: true, companies: [] };
  const companies = await prisma.company.findMany({
    where: { id: { in: auth.session.companyIds } },
    select: { id: true, name: true, accountStatus: true, planKey: true },
    orderBy: { name: "asc" },
  });
  return { released: companies.some(isCompanyReleased), companies };
}
