import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { SenderType } from "@/lib/constants";
import { sendOutboundMessageNow } from "@/services/outbound-message.service";
import { requireCompanyAccess } from "@/services/api-auth.service";

const RETRYABLE_FAILURES = new Set(["failed_retryable", "failed_final", "error"]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const message = await prisma.message.findUnique({ where: { id } });
    if (!message) return apiError(new Error("Mensagem nao encontrada"), 404);
    const guard = await requireCompanyAccess(request, message.companyId);
    if (guard.response) return guard.response;
    if (![SenderType.AI, SenderType.HUMAN].includes(message.senderType as typeof SenderType.AI | typeof SenderType.HUMAN)) {
      return apiError(new Error("Apenas mensagens de IA ou humano podem ser reenviadas."), 400);
    }
    if (!RETRYABLE_FAILURES.has(message.status)) {
      return apiError(new Error("Mensagem nao esta em estado de falha para reenvio."), 409);
    }

    await prisma.message.update({ where: { id }, data: { status: "queued", claimedAt: null, claimedBy: null, claimToken: null, leaseExpiresAt: null, nextAttemptAt: new Date() } });
    await sendOutboundMessageNow(id, { ignoreMaxAttempts: true });
    const updated = await prisma.message.findUnique({ where: { id } });
    return NextResponse.json(updated ?? { ok: true });
  } catch (error) {
    return apiError(error);
  }
}
