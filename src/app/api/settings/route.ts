import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { decryptSecret, maskSecret } from "@/services/encryption.service";
import { env } from "@/lib/env";
import { requireAdmin } from "@/services/api-auth.service";

export async function GET(request: Request) {
  try {
    const guard = await requireAdmin(request);
    if (guard.response) return guard.response;
    const settings = await prisma.systemSetting.findMany({ orderBy: { key: "asc" } });
    const sanitized = settings.map((setting) => ({
        ...setting,
        value: setting.encrypted && setting.value ? maskSecret(decryptSecret(setting.value)) : setting.value,
      }));

    if (!sanitized.some((setting) => setting.key === "openai_global_key") && env.OPENAI_API_KEY) {
      sanitized.push({
        id: "env-openai-global-key",
        key: "openai_global_key",
        value: maskSecret(env.OPENAI_API_KEY),
        encrypted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    if (!sanitized.some((setting) => setting.key === "openrouter_global_key") && env.OPENROUTER_API_KEY) {
      sanitized.push({
        id: "env-openrouter-global-key",
        key: "openrouter_global_key",
        value: maskSecret(env.OPENROUTER_API_KEY),
        encrypted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return NextResponse.json(sanitized);
  } catch (error) {
    return apiError(error);
  }
}
