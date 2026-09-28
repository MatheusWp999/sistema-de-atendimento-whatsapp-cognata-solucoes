import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { requireCompanyAccess } from "@/services/api-auth.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    if (!companyId) return apiError(new Error("Empresa obrigatoria."), 400);
    const guard = await requireCompanyAccess(request, companyId);
    if (guard.response) return guard.response;
    const memberships = await prisma.companyMembership.findMany({
      where: { companyId },
      include: { user: { select: { id: true, name: true, email: true, active: true } } },
      orderBy: { user: { name: "asc" } },
    });
    return NextResponse.json(memberships.map((membership) => ({ ...membership.user, role: membership.role })));
  } catch (error) {
    return apiError(error);
  }
}
