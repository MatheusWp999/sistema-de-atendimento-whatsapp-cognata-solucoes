import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { requireCompanyAccess } from "@/services/api-auth.service";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const guard = await requireCompanyAccess(request, id);
    if (guard.response) return guard.response;
    const logs = await prisma.aIUsageLog.findMany({ where: { companyId: id }, orderBy: { createdAt: "desc" }, take: 100 });
    return NextResponse.json(logs);
  } catch (error) {
    return apiError(error);
  }
}
