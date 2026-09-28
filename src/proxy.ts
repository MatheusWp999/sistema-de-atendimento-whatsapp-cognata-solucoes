import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIE = "central_ia_admin";
const TENANT_AUTH_COOKIE = "central_ia_user";
const PUBLIC_PREFIXES = ["/", "/_next", "/favicon.ico", "/login", "/criar-conta", "/recuperar-senha", "/api/auth/admin", "/api/auth/company", "/api/auth/register", "/api/auth/password-reset", "/api/health", "/api/webhooks/whatsapp"];
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function withSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://api.openai.com https://openrouter.ai https://graph.facebook.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  if (process.env.NODE_ENV === "production" && response.url.startsWith("https://")) {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return response;
}

function unauthorizedApi(status = 401) {
  return withSecurityHeaders(NextResponse.json({ error: status === 403 ? "Acesso negado." : "Nao autorizado." }, { status }));
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return withSecurityHeaders(NextResponse.redirect(loginUrl));
}

function isTrustedOrigin(request: NextRequest) {
  if (!UNSAFE_METHODS.has(request.method)) return true;
  if (request.nextUrl.pathname.startsWith("/api/webhooks/whatsapp")) return true;
  if (request.headers.get("authorization") || request.headers.get("x-admin-api-token")) return true;
  const origin = request.headers.get("origin") || request.headers.get("referer");
  if (!origin) return false;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

function base64UrlEncode(bytes: ArrayBuffer) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function verifySignedCookie(value: string | undefined, validate: (payload: Record<string, unknown>) => boolean) {
  return Boolean(await readSignedCookie(value, validate));
}

async function readSignedCookie(value: string | undefined, validate: (payload: Record<string, unknown>) => boolean) {
  if (!value || !process.env.APP_ENCRYPTION_KEY) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(process.env.APP_ENCRYPTION_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = base64UrlEncode(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  if (expected !== signature) return false;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const decoded = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)))) as Record<string, unknown>;
    const exp = typeof decoded.exp === "number" ? decoded.exp : 0;
    return exp >= Math.floor(Date.now() / 1000) && validate(decoded) ? decoded : false;
  } catch {
    return false;
  }
}

function tenantCookieIsReleased(payload: Record<string, unknown> | false) {
  return Boolean(payload && payload.accountStatus === "APPROVED" && payload.planKey);
}

async function readValidTenantSession(request: NextRequest) {
  return readSignedCookie(request.cookies.get(TENANT_AUTH_COOKIE)?.value, (payload) =>
    typeof payload.userId === "string" && typeof payload.companyId === "string" && Array.isArray(payload.companyIds),
  );
}

async function hasValidAdminSession(request: NextRequest) {
  return verifySignedCookie(request.cookies.get(AUTH_COOKIE)?.value, (payload) => payload.type === "admin");
}

async function isAuthorized(request: NextRequest, token: string) {
  const headerToken = request.headers.get("x-admin-api-token");
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : undefined;
  return headerToken === token || bearerToken === token || await hasValidAdminSession(request);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isTrustedOrigin(request)) return unauthorizedApi(403);
  if (isPublicPath(pathname) || /\.[a-zA-Z0-9]+$/.test(pathname)) return withSecurityHeaders(NextResponse.next());

  if (await hasValidAdminSession(request)) return withSecurityHeaders(NextResponse.next());
  const tenantSession = await readValidTenantSession(request);
  if (tenantSession) {
    if (tenantCookieIsReleased(tenantSession) || pathname === "/aguarde-liberacao") return withSecurityHeaders(NextResponse.next());
    if (pathname.startsWith("/api/")) return unauthorizedApi(403);
    return withSecurityHeaders(NextResponse.redirect(new URL("/aguarde-liberacao", request.url)));
  }

  const token = process.env.ADMIN_API_TOKEN;
  if (token && await isAuthorized(request, token)) return withSecurityHeaders(NextResponse.next());
  if (!token && process.env.NODE_ENV !== "production") return withSecurityHeaders(NextResponse.next());

  if (pathname.startsWith("/api/")) {
    return unauthorizedApi();
  }

  return redirectToLogin(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
