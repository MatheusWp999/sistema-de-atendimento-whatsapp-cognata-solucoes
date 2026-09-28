import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getUsageDashboard } from "@/services/usage.service";
import { allowedCompanyIds, getRequestAuth, scopedCompanyId, unauthorized } from "@/services/api-auth.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const auth = await getRequestAuth(request);
    if (!auth) return unauthorized();
    const companyId = scopedCompanyId(auth, searchParams.get("companyId") ?? undefined);
    if (companyId === null) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    const companyIds = allowedCompanyIds(auth);
    if (companyIds && !companyIds.length) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    const from = searchParams.get("from") ? new Date(String(searchParams.get("from"))) : undefined;
    const to = searchParams.get("to") ? new Date(String(searchParams.get("to"))) : undefined;
    const usage = await getUsageDashboard({ companyId, companyIds: companyId ? undefined : companyIds, from, to });
    return NextResponse.json(usage);
  } catch (error) {
    return apiError(error);
  }
}
