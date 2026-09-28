import type { Company } from "@prisma/client";
import { resolveOpenAIConfig } from "@/modules/ai/ai-provider.factory";

export async function generateCompanyEmbedding(company: Company, input: string) {
  const config = await resolveOpenAIConfig(company);
  if (!config.apiKey) return [];
  return config.provider.generateEmbedding({
    apiKey: config.apiKey,
    model: config.embeddingModel,
    input,
  });
}
