import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { recordAuditEvent } from "@/services/audit.service";
import { requireCompanyAccess } from "@/services/api-auth.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { companyId } = await request.json();
    if (!companyId) return apiError(new Error("companyId e obrigatorio"), 400);
    if (!/^[a-z0-9_-]{8,64}$/i.test(companyId)) return apiError(new Error("companyId invalido"), 400);
    const guard = await requireCompanyAccess(request, companyId);
    if (guard.response) return guard.response;
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) return apiError(new Error("Empresa nao encontrada"), 404);
    await prisma.company.update({
      where: { id: companyId },
      data: { whatsappConnectionStatus: "CONNECTING", whatsappSessionEnabled: true, whatsappLastError: null, whatsappQrCodeDataUrl: null, whatsappQrCodeUpdatedAt: null },
    });
    const command = await prisma.whatsAppSessionCommand.create({ data: { companyId, action: "start", status: "queued" } });
    await recordAuditEvent({ request, companyId, action: "whatsapp_qr.start_requested", entityType: "WhatsAppSessionCommand", entityId: command.id });
    return NextResponse.json({ companyId, commandId: command.id, status: "queued" }, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
