import { NextResponse } from "next/server";
import type { Company } from "@prisma/client";
import { decryptSecret, maskSecret } from "@/services/encryption.service";

export function apiError(error: unknown, status = 500) {
  const message = status >= 500 ? "Erro interno" : error instanceof Error ? error.message : "Erro inesperado";
  return NextResponse.json({ error: message }, { status });
}

export function sanitizeCompany<T extends Company>(company: T) {
  const { openAiApiKeyEncrypted, openRouterApiKeyEncrypted, ...safeCompany } = company;
  return {
    ...safeCompany,
    openAiKeyMasked: openAiApiKeyEncrypted ? maskSecret(decryptSecret(openAiApiKeyEncrypted)) : "",
    openRouterKeyMasked: openRouterApiKeyEncrypted ? maskSecret(decryptSecret(openRouterApiKeyEncrypted)) : "",
  };
}

export function sanitizeCompanies<T extends Company>(companies: T[]) {
  return companies.map(sanitizeCompany);
}
