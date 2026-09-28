import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";

export const TENANT_AUTH_COOKIE = "central_ia_user";
export const ADMIN_AUTH_COOKIE = "central_ia_admin";

export type TenantSession = {
  userId: string;
  email: string;
  name: string;
  role: string;
  companyId: string;
  companyIds: string[];
  accountStatus?: string;
  planKey?: string | null;
  exp: number;
};

type AdminSession = {
  type: "admin";
  userId?: string;
  email?: string;
  name?: string;
  exp: number;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payload: string) {
  return createHmac("sha256", env.APP_ENCRYPTION_KEY).update(payload).digest("base64url");
}

function createSignedCookie(payload: unknown) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function verifySignedCookie<T>(value: string | undefined | null, validate: (payload: T) => boolean): T | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) return null;

  try {
    const session = JSON.parse(base64UrlDecode(payload)) as T;
    return validate(session) ? session : null;
  } catch {
    return null;
  }
}

export function createTenantSessionCookie(input: Omit<TenantSession, "exp">, maxAgeSeconds = 60 * 60 * 8) {
  const session: TenantSession = { ...input, exp: Math.floor(Date.now() / 1000) + maxAgeSeconds };
  return createSignedCookie(session);
}

export function shouldUseSecureCookies(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  return forwardedProto === "https" || new URL(request.url).protocol === "https:";
}

export function verifyTenantSessionCookie(value: string | undefined | null): TenantSession | null {
  return verifySignedCookie<TenantSession>(value, (session) => {
    if (!session.userId || !session.companyId || !Array.isArray(session.companyIds)) return false;
    if (session.exp < Math.floor(Date.now() / 1000)) return false;
    return true;
  });
}

export function createAdminSessionCookie(input?: { userId?: string; email?: string; name?: string }, maxAgeSeconds = 60 * 60 * 8) {
  return createSignedCookie({ type: "admin", ...input, exp: Math.floor(Date.now() / 1000) + maxAgeSeconds } satisfies AdminSession);
}

export function verifyAdminSession(value: string | undefined | null) {
  return verifySignedCookie<AdminSession>(value, (session) => session.type === "admin" && session.exp >= Math.floor(Date.now() / 1000));
}

export function verifyAdminSessionCookie(value: string | undefined | null) {
  return Boolean(verifyAdminSession(value));
}

export function isAdminCookieAuthorized(cookieValue: string | undefined | null) {
  return verifyAdminSessionCookie(cookieValue);
}
