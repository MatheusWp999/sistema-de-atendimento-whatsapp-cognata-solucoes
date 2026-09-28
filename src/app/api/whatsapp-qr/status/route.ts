import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireCompanyAccess } from "@/services/api-auth.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    if (!companyId) return apiError(new Error("companyId e obrigatorio"), 400);
    if (!/^[a-z0-9_-]{8,64}$/i.test(companyId)) return apiError(new Error("companyId invalido"), 400);
    const guard = await requireCompanyAccess(request, companyId);
    if (guard.response) return guard.response;
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        whatsappConnectionStatus: true,
        whatsappNumber: true,
        whatsappLastError: true,
        whatsappLastSeenAt: true,
        whatsappQrCodeDataUrl: true,
        whatsappQrCodeUpdatedAt: true,
      },
    });
    if (!company) return apiError(new Error("Empresa nao encontrada"), 404);

    if (company.whatsappConnectionStatus === "QR_REQUIRED") {
      return NextResponse.json({
        companyId,
        status: "qr",
        qrCodeDataUrl: company.whatsappQrCodeDataUrl ?? undefined,
        qrCodeUpdatedAt: company.whatsappQrCodeUpdatedAt?.toISOString(),
        phoneNumber: company.whatsappNumber ?? undefined,
        lastError: company.whatsappLastError ?? undefined,
      });
    }

    return NextResponse.json({
      companyId,
      status: company.whatsappConnectionStatus.toLowerCase(),
      phoneNumber: company.whatsappNumber ?? undefined,
      lastError: company.whatsappLastError ?? undefined,
      lastHealthCheckAt: company.whatsappLastSeenAt?.toISOString(),
    });
  } catch (error) {
    return apiError(error);
  }
}
