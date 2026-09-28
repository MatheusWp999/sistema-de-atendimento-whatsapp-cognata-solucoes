import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { resolveAIConfig } from "@/modules/ai/ai-provider.factory";
import { requireCompanyAccess } from "@/services/api-auth.service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const guard = await requireCompanyAccess(request, id);
    if (guard.response) return guard.response;
    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) return apiError(new Error("Empresa nao encontrada"), 404);

    const config = await resolveAIConfig(company);
    if (!config.apiKey) {
      return apiError(new Error(`Nenhuma chave ${config.providerName === "openrouter" ? "OpenRouter" : "OpenAI"} ativa para esta empresa.`), 400);
    }

    const result = await config.provider.generateResponse({
      apiKey: config.apiKey,
      model: config.model,
      prompt: "Responda exatamente: OK",
      temperature: 0,
      maxTokens: 10,
    });

    return NextResponse.json({
      ok: true,
      provider: config.providerName,
      model: result.model,
      usedCompanyKey: config.usedCompanyKey,
      content: result.content,
    });
  } catch (error) {
    return apiError(error, 400);
  }
}
