import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { encryptSecret, maskSecret } from "@/services/encryption.service";
import { requireAdmin } from "@/services/api-auth.service";

export async function PUT(request: Request) {
  try {
    const guard = await requireAdmin(request);
    if (guard.response) return guard.response;
    const { apiKey } = await request.json();
    if (!apiKey || typeof apiKey !== "string" || apiKey.length > 500) return apiError(new Error("Chave invalida"), 400);
    await prisma.systemSetting.upsert({
      where: { key: "openrouter_global_key" },
      create: { key: "openrouter_global_key", value: encryptSecret(apiKey), encrypted: true },
      update: { value: encryptSecret(apiKey), encrypted: true },
    });
    return NextResponse.json({ ok: true, openRouterKeyMasked: maskSecret(apiKey) });
  } catch (error) {
    return apiError(error);
  }
}
