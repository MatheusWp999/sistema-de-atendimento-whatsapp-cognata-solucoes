import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, sanitizeCompany } from "@/lib/api";
import { requireCompanyAccess } from "@/services/api-auth.service";

const providers = new Set(["openai", "openrouter"]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const guard = await requireCompanyAccess(request, id);
    if (guard.response) return guard.response;
    const { aiProvider, defaultAiModel, openRouterModel, embeddingModel, fallbackAiModel } = await request.json();
    if (aiProvider && !providers.has(aiProvider)) return apiError(new Error("Provedor invalido"), 400);

    const company = await prisma.company.update({
      where: { id },
      data: {
        ...(aiProvider ? { aiProvider } : {}),
        ...(typeof defaultAiModel === "string" ? { defaultAiModel } : {}),
        ...(typeof fallbackAiModel === "string" ? { fallbackAiModel } : {}),
        ...(typeof openRouterModel === "string" ? { openRouterModel } : {}),
        ...(typeof embeddingModel === "string" ? { embeddingModel } : {}),
      },
    });

    return NextResponse.json(sanitizeCompany(company));
  } catch (error) {
    return apiError(error);
  }
}
