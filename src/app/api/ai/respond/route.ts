import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { env } from "@/lib/env";
import { handleIncomingMessage } from "@/services/message-orchestrator.service";
import { requireCompanyAccess } from "@/services/api-auth.service";

export async function POST(request: Request) {
  try {
    if (env.ENABLE_DIRECT_AI_RESPOND !== "true") {
      return apiError(new Error("Endpoint direto de resposta IA desativado. Use webhooks, WhatsApp QR ou simulação da conversa."), 403);
    }
    const body = await request.json();
    const companyId = typeof body.companyId === "string" ? body.companyId : "";
    const guard = await requireCompanyAccess(request, companyId);
    if (guard.response) return guard.response;
    if (typeof body.message !== "string" || body.message.length > 4000) return apiError(new Error("Mensagem invalida"), 400);
    const result = await handleIncomingMessage(body);
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
