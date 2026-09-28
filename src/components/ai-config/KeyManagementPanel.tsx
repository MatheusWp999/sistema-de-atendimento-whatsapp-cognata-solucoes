"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { CompanyDTO } from "@/components/chat/types";
import { StatusBadge } from "@/components/ui/StatusBadge";

type SettingsDTO = Array<{ key: string; value?: string | null; encrypted: boolean }>;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) throw new Error((await response.json()).error ?? "Erro na requisicao");
  return response.json();
}

function KeySourceBadge({ provider, company }: { provider: "openai" | "openrouter"; company: CompanyDTO }) {
  const own = provider === "openai" ? company.useOwnOpenAiKey : company.useOwnOpenRouterKey;
  const masked = provider === "openai" ? company.openAiKeyMasked : company.openRouterKeyMasked;
  if (own && masked) return <StatusBadge label="Chave individual" tone="green" />;
  if (own && !masked) return <StatusBadge label="Individual sem chave" tone="red" />;
  return <StatusBadge label="Chave geral" tone="blue" />;
}

export function KeyManagementPanel() {
  const queryClient = useQueryClient();
  const [globalOpenAiKey, setGlobalOpenAiKey] = useState("");
  const [globalOpenRouterKey, setGlobalOpenRouterKey] = useState("");
  const [companyKeys, setCompanyKeys] = useState<Record<string, { openai?: string; openrouter?: string }>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const companies = useQuery({ queryKey: ["companies"], queryFn: () => api<CompanyDTO[]>("/api/companies") });
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => api<SettingsDTO>("/api/settings") });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["companies"] });
    queryClient.invalidateQueries({ queryKey: ["settings"] });
  };

  const saveGlobalOpenAi = useMutation({
    mutationFn: () => api("/api/settings/openai-global-key", { method: "PUT", body: JSON.stringify({ apiKey: globalOpenAiKey }) }),
    onSuccess: () => {
      setGlobalOpenAiKey("");
      refresh();
    },
    onError: (mutationError) => setError(mutationError instanceof Error ? mutationError.message : "Erro ao salvar OpenAI"),
  });

  const saveGlobalOpenRouter = useMutation({
    mutationFn: () => api("/api/settings/openrouter-global-key", { method: "PUT", body: JSON.stringify({ apiKey: globalOpenRouterKey }) }),
    onSuccess: () => {
      setGlobalOpenRouterKey("");
      refresh();
    },
    onError: (mutationError) => setError(mutationError instanceof Error ? mutationError.message : "Erro ao salvar OpenRouter"),
  });

  const updateProvider = useMutation({
    mutationFn: ({ companyId, body }: { companyId: string; body: Record<string, string> }) =>
      api(`/api/companies/${companyId}/ai-provider`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: refresh,
    onError: (mutationError) => setError(mutationError instanceof Error ? mutationError.message : "Erro ao atualizar provedor"),
  });

  const updateKey = useMutation({
    mutationFn: ({ companyId, provider, apiKey, useOwnKey }: { companyId: string; provider: "openai" | "openrouter"; apiKey?: string; useOwnKey: boolean }) =>
      api(`/api/companies/${companyId}/${provider === "openai" ? "openai-key" : "openrouter-key"}`, {
        method: "PATCH",
        body: JSON.stringify(provider === "openai" ? { apiKey, useOwnOpenAiKey: useOwnKey } : { apiKey, useOwnOpenRouterKey: useOwnKey }),
      }),
    onSuccess: refresh,
    onError: (mutationError) => setError(mutationError instanceof Error ? mutationError.message : "Erro ao atualizar chave"),
  });

  const testCompanyAI = useMutation({
    mutationFn: ({ companyId }: { companyId: string }) =>
      api<{ provider: string; model: string; usedCompanyKey: boolean }>(`/api/companies/${companyId}/test-ai`, { method: "POST" }),
    onSuccess: (result) => {
      setError("");
      setNotice(`Teste OK: ${result.provider} respondeu com ${result.model} usando ${result.usedCompanyKey ? "chave individual" : "chave geral"}.`);
    },
    onError: (mutationError) => {
      setNotice("");
      setError(mutationError instanceof Error ? mutationError.message : "Erro ao testar IA da empresa");
    },
  });

  const openAiGlobal = settings.data?.find((setting) => setting.key === "openai_global_key")?.value;
  const openRouterGlobal = settings.data?.find((setting) => setting.key === "openrouter_global_key")?.value;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Chave geral OpenAI</h2>
          <p className="mt-1 text-sm text-slate-500">Usada por empresas sem chave OpenAI individual.</p>
          <p className="mt-3 text-sm font-semibold text-slate-700">Atual: {openAiGlobal || "Nao configurada"}</p>
          <div className="mt-4 flex gap-2">
            <input value={globalOpenAiKey} onChange={(event) => setGlobalOpenAiKey(event.target.value)} placeholder="sk-..." className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm text-black" />
            <button onClick={() => saveGlobalOpenAi.mutate()} disabled={!globalOpenAiKey || saveGlobalOpenAi.isPending} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Salvar</button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Chave geral OpenRouter</h2>
          <p className="mt-1 text-sm text-slate-500">Usada por empresas sem chave OpenRouter individual.</p>
          <p className="mt-3 text-sm font-semibold text-slate-700">Atual: {openRouterGlobal || "Nao configurada"}</p>
          <div className="mt-4 flex gap-2">
            <input value={globalOpenRouterKey} onChange={(event) => setGlobalOpenRouterKey(event.target.value)} placeholder="sk-or-..." className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm text-black" />
            <button onClick={() => saveGlobalOpenRouter.mutate()} disabled={!globalOpenRouterKey || saveGlobalOpenRouter.isPending} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Salvar</button>
          </div>
        </div>
      </section>

      {notice && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-xl font-bold text-slate-900">Operacao por empresa</h2>
          <p className="text-sm text-slate-500">Veja rapidamente qual provedor, chave e modelo cada empresa esta usando.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {(companies.data ?? []).map((company) => {
            const provider = company.aiProvider === "openrouter" ? "openrouter" : "openai";
            return (
              <div key={company.id} className="grid gap-4 p-5 xl:grid-cols-[1.2fr_1fr_1fr]">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{company.name}</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusBadge label={provider === "openrouter" ? "OpenRouter ativo" : "OpenAI ativo"} tone={provider === "openrouter" ? "amber" : "green"} />
                    <KeySourceBadge provider={provider} company={company} />
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    Modelo ativo: <strong>{provider === "openrouter" ? company.openRouterModel || "padrao OpenRouter" : company.defaultAiModel || "padrao OpenAI"}</strong>
                  </p>
                  <p className="text-sm text-slate-600">Embedding/RAG: <strong>{company.embeddingModel || "text-embedding-3-small"}</strong></p>
                  <button
                    onClick={() => testCompanyAI.mutate({ companyId: company.id })}
                    disabled={testCompanyAI.isPending}
                    className="mt-3 rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                  >
                    {testCompanyAI.isPending ? "Testando..." : "Testar IA ativa"}
                  </button>
                </div>

                <div className="space-y-2">
                  <select
                    value={provider}
                    onChange={(event) => updateProvider.mutate({ companyId: company.id, body: { aiProvider: event.target.value } })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-black"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="openrouter">OpenRouter</option>
                  </select>
                  <input
                    defaultValue={company.defaultAiModel || "gpt-4o-mini"}
                    onBlur={(event) => updateProvider.mutate({ companyId: company.id, body: { defaultAiModel: event.target.value } })}
                    placeholder="Modelo OpenAI"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-black"
                  />
                  <input
                    defaultValue={company.openRouterModel || "meta-llama/llama-3.1-8b-instruct:free"}
                    onBlur={(event) => updateProvider.mutate({ companyId: company.id, body: { openRouterModel: event.target.value } })}
                    placeholder="Modelo OpenRouter"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-black"
                  />
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2"><strong>OpenAI</strong><span className="text-xs text-slate-500">{company.openAiKeyMasked || "sem individual"}</span></div>
                    <div className="mt-2 flex gap-2">
                      <input
                        value={companyKeys[company.id]?.openai ?? ""}
                        onChange={(event) => setCompanyKeys((current) => ({ ...current, [company.id]: { ...current[company.id], openai: event.target.value } }))}
                        placeholder="chave individual OpenAI"
                        className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-xs text-black"
                      />
                      <button onClick={() => updateKey.mutate({ companyId: company.id, provider: "openai", apiKey: companyKeys[company.id]?.openai, useOwnKey: true })} className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white">Usar</button>
                      <button onClick={() => updateKey.mutate({ companyId: company.id, provider: "openai", useOwnKey: false })} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-bold text-slate-700">Geral</button>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2"><strong>OpenRouter</strong><span className="text-xs text-slate-500">{company.openRouterKeyMasked || "sem individual"}</span></div>
                    <div className="mt-2 flex gap-2">
                      <input
                        value={companyKeys[company.id]?.openrouter ?? ""}
                        onChange={(event) => setCompanyKeys((current) => ({ ...current, [company.id]: { ...current[company.id], openrouter: event.target.value } }))}
                        placeholder="chave individual OpenRouter"
                        className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-xs text-black"
                      />
                      <button onClick={() => updateKey.mutate({ companyId: company.id, provider: "openrouter", apiKey: companyKeys[company.id]?.openrouter, useOwnKey: true })} className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white">Usar</button>
                      <button onClick={() => updateKey.mutate({ companyId: company.id, provider: "openrouter", useOwnKey: false })} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-bold text-slate-700">Geral</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
