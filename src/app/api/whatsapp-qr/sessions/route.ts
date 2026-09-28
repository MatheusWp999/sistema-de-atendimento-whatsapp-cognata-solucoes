import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { whatsappQrSessionManager } from "@/modules/providers/whatsapp-qr.service";
import { allowedCompanyIds, getRequestAuth, unauthorized } from "@/services/api-auth.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await getRequestAuth(request);
    if (!auth) return unauthorized();
    const companyIds = allowedCompanyIds(auth);
    if (companyIds && !companyIds.length) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    await whatsappQrSessionManager.restoreEnabledSessions();
    await whatsappQrSessionManager.refreshAllEnabledSessionsHealth();
    return NextResponse.json(whatsappQrSessionManager.getAllSnapshots()
      .filter((snapshot) => !companyIds || companyIds.includes(snapshot.companyId))
      .map((snapshot) => ({ ...snapshot, qrCodeDataUrl: undefined })));
  } catch (error) {
    return apiError(error);
  }
}
