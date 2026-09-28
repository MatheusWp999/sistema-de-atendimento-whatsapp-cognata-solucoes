import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { apiError } from "@/lib/api";
import { enqueueWhatsAppCloudInboundEvents } from "@/services/inbound-event.service";

export const runtime = "nodejs";

function isValidSignature(rawBody: string, signature: string | null) {
  if (!env.WHATSAPP_APP_SECRET || !signature?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", env.WHATSAPP_APP_SECRET).update(rawBody).digest("hex");
  const actual = signature.slice("sha256=".length);
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(actual, "hex");
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && challenge && env.WHATSAPP_VERIFY_TOKEN && token === env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 1024 * 1024) return NextResponse.json({ error: "Payload muito grande." }, { status: 413 });
    const rawBody = await request.text();
    if (rawBody.length > 1024 * 1024) return NextResponse.json({ error: "Payload muito grande." }, { status: 413 });
    if (!isValidSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
      return NextResponse.json({ error: "Assinatura do webhook invalida." }, { status: 401 });
    }
    const body = JSON.parse(rawBody);
    const result = await enqueueWhatsAppCloudInboundEvents(body);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return apiError(error);
  }
}
