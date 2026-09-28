import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, sanitizeCompany } from "@/lib/api";
import { encryptSecret } from "@/services/encryption.service";
import { requireCompanyAccess } from "@/services/api-auth.service";

const openRouterKeySchema = z.object({
  apiKey: z.string().trim().optional().transform((value) => value || undefined),
  useOwnOpenRouterKey: z.boolean(),
}).strict();

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const guard = await requireCompanyAccess(request, id);
    if (guard.response) return guard.response;
    const parsed = openRouterKeySchema.safeParse(await request.json());
    if (!parsed.success) return apiError(new Error(parsed.error.issues[0]?.message ?? "Dados invalidos"), 400);
    const { apiKey, useOwnOpenRouterKey } = parsed.data;

    const existing = await prisma.company.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return apiError(new Error("Empresa nao encontrada"), 404);

    const company = await prisma.company.update({
      where: { id },
      data: {
        useOwnOpenRouterKey,
        ...(apiKey ? { openRouterApiKeyEncrypted: encryptSecret(apiKey) } : {}),
      },
    });
    return NextResponse.json(sanitizeCompany(company));
  } catch (error) {
    return apiError(error);
  }
}
