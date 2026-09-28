import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { allowedCompanyIds, getRequestAuth, scopedCompanyId, unauthorized } from "@/services/api-auth.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const auth = await getRequestAuth(request);
    if (!auth) return unauthorized();
    const companyId = scopedCompanyId(auth, searchParams.get("companyId"));
    if (companyId === null) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    const allowedIds = allowedCompanyIds(auth);
    const logs = await prisma.aIGovernanceLog.findMany({
      where: companyId ? { companyId } : allowedIds ? { companyId: { in: allowedIds } } : undefined,
      include: { conversation: { select: { customerName: true, customerPhone: true } }, company: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json(logs);
  } catch (error) {
    return apiError(error);
  }
}
