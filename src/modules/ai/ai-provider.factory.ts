import type { Company } from "@prisma/client";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/services/encryption.service";
import { OpenAIProvider } from "./providers/openai.provider";
import { OpenRouterProvider } from "./providers/openrouter.provider";

async function getEncryptedSettingValue(key: string) {
  const setting = await prisma.systemSetting.findUnique({ where: { key } });
  return setting?.value && setting.encrypted ? decryptSecret(setting.value) : setting?.value || "";
}

export async function resolveOpenAIConfig(company: Company) {
  const savedGlobalKey = await getEncryptedSettingValue("openai_global_key");
  const globalKey = savedGlobalKey || env.OPENAI_API_KEY;
  const shouldUseCompanyKey = Boolean(company.useOwnOpenAiKey && company.openAiApiKeyEncrypted);
  const companyKey = shouldUseCompanyKey ? decryptSecret(company.openAiApiKeyEncrypted ?? "") : "";
  const apiKey = companyKey || globalKey;

  return {
    provider: new OpenAIProvider(),
    apiKey: apiKey ?? "",
    usedCompanyKey: Boolean(companyKey),
    model: company.defaultAiModel || env.DEFAULT_AI_MODEL,
    fallbackModel: company.fallbackAiModel || env.DEFAULT_AI_MODEL,
    embeddingModel: company.embeddingModel || env.DEFAULT_EMBEDDING_MODEL,
    providerName: "openai" as const,
  };
}

export async function resolveOpenRouterConfig(company: Company) {
  const savedGlobalKey = await getEncryptedSettingValue("openrouter_global_key");
  const globalKey = savedGlobalKey || env.OPENROUTER_API_KEY;
  const shouldUseCompanyKey = Boolean(company.useOwnOpenRouterKey && company.openRouterApiKeyEncrypted);
  const companyKey = shouldUseCompanyKey ? decryptSecret(company.openRouterApiKeyEncrypted ?? "") : "";
  const apiKey = companyKey || globalKey;

  return {
    provider: new OpenRouterProvider(),
    apiKey: apiKey ?? "",
    usedCompanyKey: Boolean(companyKey),
    model: company.openRouterModel || env.DEFAULT_OPENROUTER_MODEL,
    fallbackModel: company.openRouterModel || env.DEFAULT_OPENROUTER_MODEL,
    embeddingModel: company.embeddingModel || env.DEFAULT_EMBEDDING_MODEL,
    providerName: "openrouter" as const,
  };
}

export async function resolveAIConfig(company: Company) {
  if (company.aiProvider === "openrouter") {
    return resolveOpenRouterConfig(company);
  }

  return resolveOpenAIConfig(company);
}
