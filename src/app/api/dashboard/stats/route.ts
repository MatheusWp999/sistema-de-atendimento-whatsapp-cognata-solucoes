import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getDashboardStats } from "@/services/dashboard-stats.service";
import { companyScopeFromReleasedAuth, getCurrentAuth } from "@/services/server-auth.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const auth = await getCurrentAuth();
    const companyId = await companyScopeFromReleasedAuth(auth, searchParams.get("companyId") || undefined);
    if (companyId === "__unauthorized__") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    return NextResponse.json(await getDashboardStats(companyId));
  } catch (error) {
    return apiError(error);
  }
}
