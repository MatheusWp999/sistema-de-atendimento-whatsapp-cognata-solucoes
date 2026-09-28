import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { isCompanyReleased } from "@/services/account-approval.service";
import { ADMIN_AUTH_COOKIE, TENANT_AUTH_COOKIE, verifyAdminSessionCookie, verifyTenantSessionCookie, type TenantSession } from "@/services/tenant-session.service";

export type ApiAuth = { type: "admin" } | { type: "company_user"; session: TenantSession; releasedCompanyIds: string[] };

function parseCookies(header: string | null) {
  const cookies = new Map<string, string>();
  for (const part of header?.split(";") ?? []) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName) continue;
    cookies.set(rawName, decodeURIComponent(rawValue.join("=")));
  }
  return cookies;
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : undefined;
}

export function unauthorized() {
  return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
}

export async function getRequestAuth(request: Request): Promise<ApiAuth | null> {
  const cookies = parseCookies(request.headers.get("cookie"));
  const headerToken = request.headers.get("x-admin-api-token");
  const token = headerToken || bearerToken(request);
  if (env.ADMIN_API_TOKEN && token === env.ADMIN_API_TOKEN) return { type: "admin" };
  if (verifyAdminSessionCookie(cookies.get(ADMIN_AUTH_COOKIE))) return { type: "admin" };

  const session = verifyTenantSessionCookie(cookies.get(TENANT_AUTH_COOKIE));
  if (!session) return null;
  const companies = await prisma.company.findMany({
    where: { id: { in: session.companyIds } },
    select: { id: true, accountStatus: true, planKey: true },
  });
  return { type: "company_user", session, releasedCompanyIds: companies.filter(isCompanyReleased).map((company) => company.id) };
}

export async function requireAdmin(request: Request) {
  const auth = await getRequestAuth(request);
  if (!auth) return { response: unauthorized() as NextResponse, auth: null };
  if (auth.type !== "admin") return { response: forbidden() as NextResponse, auth: null };
  return { auth, response: null };
}

export async function requireCompanyAccess(request: Request, companyId: string) {
  const auth = await getRequestAuth(request);
  if (!auth) return { response: unauthorized() as NextResponse, auth: null };
  if (auth.type === "admin") return { auth, response: null };
  if (!auth.session.companyIds.includes(companyId)) return { response: forbidden() as NextResponse, auth: null };
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { accountStatus: true, planKey: true } });
  if (!company || !isCompanyReleased(company)) return { response: forbidden() as NextResponse, auth: null };
  return { auth, response: null };
}

export function allowedCompanyIds(auth: ApiAuth | null) {
  return auth?.type === "company_user" ? auth.releasedCompanyIds : undefined;
}

export function scopedCompanyId(auth: ApiAuth | null, requestedCompanyId?: string | null) {
  if (!auth) return null;
  if (auth.type === "admin") return requestedCompanyId || undefined;
  if (requestedCompanyId) return auth.releasedCompanyIds.includes(requestedCompanyId) ? requestedCompanyId : null;
  if (auth.releasedCompanyIds.includes(auth.session.companyId)) return auth.session.companyId;
  return auth.releasedCompanyIds[0] ?? null;
}
