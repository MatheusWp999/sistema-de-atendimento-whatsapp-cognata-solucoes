import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createAdminSessionCookie, shouldUseSecureCookies } from "@/services/tenant-session.service";
import { checkRateLimit } from "@/services/rate-limit.service";

const AUTH_COOKIE = "central_ia_admin";

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(request, "auth:admin", { limit: 8, windowMs: 60_000 });
  if (!rateLimit.allowed) return NextResponse.json({ error: "Muitas tentativas. Aguarde antes de tentar novamente." }, { status: 429 });

  if (!env.ADMIN_API_TOKEN) {
    return NextResponse.json({ error: "ADMIN_API_TOKEN nao configurado." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  if (token.length > 500) return NextResponse.json({ error: "Token administrativo invalido." }, { status: 401 });
  if (token !== env.ADMIN_API_TOKEN) {
    return NextResponse.json({ error: "Token administrativo invalido." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, createAdminSessionCookie(), {
    httpOnly: true,
    sameSite: "strict",
    secure: shouldUseSecureCookies(request),
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
