import { createHmac } from "crypto";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { decryptSecret } from "@/services/encryption.service";
import { requireCompanyAccess } from "@/services/api-auth.service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id } });
    if (!endpoint) return apiError(new Error("Integracao nao encontrada."), 404);
    const guard = await requireCompanyAccess(request, endpoint.companyId);
    if (guard.response) return guard.response;
    const payload = { event: "integration.test", companyId: endpoint.companyId, sentAt: new Date().toISOString() };
    const body = JSON.stringify(payload);
    const secret = endpoint.secretEncrypted ? decryptSecret(endpoint.secretEncrypted) : "";
    const headers: Record<string, string> = { "Content-Type": "application/json", "x-cognita-event": "integration.test" };
    if (secret) headers["x-cognita-signature"] = createHmac("sha256", secret).update(body).digest("hex");
    const delivery = await prisma.webhookDelivery.create({ data: { companyId: endpoint.companyId, endpointId: endpoint.id, event: "integration.test", payload } });

    try {
      const response = await fetch(endpoint.url, { method: "POST", headers, body });
      const responseBody = (await response.text()).slice(0, 2000);
      await prisma.webhookDelivery.update({ where: { id: delivery.id }, data: { status: response.ok ? "delivered" : "failed", attempts: 1, httpStatus: response.status, responseBody, deliveredAt: response.ok ? new Date() : undefined } });
      await prisma.webhookEndpoint.update({ where: { id: endpoint.id }, data: { lastDeliveryAt: new Date(), lastError: response.ok ? null : responseBody.slice(0, 500) } });
      if (!response.ok) return apiError(new Error(`Webhook respondeu HTTP ${response.status}.`), 502);
      return Response.json({ ok: true, status: response.status });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      await prisma.webhookDelivery.update({ where: { id: delivery.id }, data: { status: "failed", attempts: 1, errorMessage: message } });
      await prisma.webhookEndpoint.update({ where: { id: endpoint.id }, data: { lastDeliveryAt: new Date(), lastError: message } });
      return apiError(new Error(message), 502);
    }
  } catch (error) {
    return apiError(error);
  }
}
