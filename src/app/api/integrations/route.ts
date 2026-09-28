import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { encryptSecret, maskSecret, decryptSecret } from "@/services/encryption.service";
import { allowedCompanyIds, getRequestAuth, requireCompanyAccess, scopedCompanyId, unauthorized } from "@/services/api-auth.service";

const integrationSchema = z.object({
  companyId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(120),
  url: z.string().url().max(500),
  events: z.array(z.string().trim().min(2).max(80)).max(20).default(["message.created"]),
  active: z.boolean().default(true),
  secret: z.string().trim().max(200).optional(),
}).strict();

function zodMessage(error: z.ZodError) {
  const issue = error.issues[0];
  const field = issue?.path.join(".");
  return field ? `${field}: ${issue.message}` : issue?.message ?? "Dados invalidos";
}

function sanitizeEndpoint<T extends { secretEncrypted: string | null }>(endpoint: T) {
  const { secretEncrypted, ...safe } = endpoint;
  return { ...safe, secretMasked: secretEncrypted ? maskSecret(decryptSecret(secretEncrypted)) : "" };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const auth = await getRequestAuth(request);
    if (!auth) return unauthorized();
    const companyId = scopedCompanyId(auth, searchParams.get("companyId"));
    if (companyId === null) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    const allowedIds = allowedCompanyIds(auth);
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: companyId ? { companyId } : allowedIds ? { companyId: { in: allowedIds } } : undefined,
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(endpoints.map(sanitizeEndpoint));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = integrationSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(new Error(zodMessage(parsed.error)), 400);
    const body = parsed.data;
    const guard = await requireCompanyAccess(request, body.companyId);
    if (guard.response) return guard.response;
    const endpoint = await prisma.webhookEndpoint.create({
      data: { companyId: body.companyId, name: body.name, url: body.url, events: body.events, active: body.active, secretEncrypted: body.secret ? encryptSecret(body.secret) : undefined },
    });
    return NextResponse.json(sanitizeEndpoint(endpoint), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
