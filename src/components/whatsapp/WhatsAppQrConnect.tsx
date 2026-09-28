"use client";

/* eslint-disable @next/next/no-img-element */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { CompanyDTO } from "@/components/chat/types";
import { StatusBadge } from "@/components/ui/StatusBadge";

type SessionStatus = {
  companyId: string;
  status: "idle" | "connecting" | "qr" | "connected" | "stale" | "disconnected" | "error";
  qrCodeDataUrl?: string;
  phoneNumber?: string;
  startedAt?: string;
  lastError?: string;
  lastHealthCheckAt?: string;
  lastSuccessfulHealthCheckAt?: string;
  healthFailures?: number;
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) throw new Error((await response.json()).error ?? "Erro na requisicao");
  return response.json();
}

export function WhatsAppQrConnect({ canCreateCompany = false }: { canCreateCompany?: boolean }) {
  const queryClient = useQueryClient();
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [assistantName, setAssistantName] = useState("Atendente IA");

  const companies = useQuery({ queryKey: ["companies"], queryFn: () => api<CompanyDTO[]>("/api/companies") });
  const activeCompanyId = selectedCompanyId || companies.data?.[0]?.id || "";
  const status = useQuery({
    queryKey: ["whatsapp-qr-status", activeCompanyId],
    queryFn: () => api<SessionStatus>(`/api/whatsapp-qr/status?companyId=${activeCompanyId}`),
    enabled: Boolean(activeCompanyId),
    refetchInterval: 2500,
  });

  const createCompany = useMutation({
    mutationFn: async () => {
      if (!companyName.trim()) throw new Error("Informe o nome da empresa real.");
      const company = await api<CompanyDTO>("/api/companies", {
        method: "POST",
        body: JSON.stringify({
          name: companyName.trim(),
          description: "Empresa real conectada via WhatsApp QR local.",
          aiEnabled: true,
          defaultAiModel: "gpt-4o-mini",
          embeddingModel: "text-embedding-3-small",
          dailyMessageLimit: 300,
          monthlyMessageLimit: 5000,
          dailyCostLimit: 20,
          monthlyCostLimit: 300,
        }),
      });
      await api("/api/assistants", {
        method: "POST",
        body: JSON.stringify({
          companyId: company.id,
          name: assistantName.trim() || "Atendente IA",
          role: "Atendente comercial",
          personality: "Natural, profissional, segura e objetiva.",
          tone: "Humano, claro e prestativo.",
          greetingMessage: `Ola! Sou ${assistantName.trim() || "Atendente IA"}, atendente da ${company.name}. Como posso ajudar?`,
          closingMessage: "Fico a disposicao. Posso ajudar com mais alguma coisa?",
          mandatoryRules: "Responder em portugues do Brasil. Nao inventar informacoes. Usar apenas dados da empresa atual.",
          forbiddenRules: "Nao prometer descontos, aprovacoes, resultados ou condicoes especiais sem base.",
          humanEscalationRules: "Encaminhar para humano quando faltar informacao, houver reclamacao, juridico, cancelamento ou dados sensiveis.",
          fallbackMessage: "Para te passar essa informacao com seguranca, vou encaminhar sua conversa para um atendente responsavel.",
        }),
      });
      return company;
    },
    onSuccess: async (company) => {
      setSelectedCompanyId(company.id);
      setCompanyName("");
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });

  const start = useMutation({
    mutationFn: () => api<SessionStatus>("/api/whatsapp-qr/start", { method: "POST", body: JSON.stringify({ companyId: activeCompanyId }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp-qr-status", activeCompanyId] }),
  });

  const disconnect = useMutation({
    mutationFn: () => api<SessionStatus>("/api/whatsapp-qr/disconnect", { method: "POST", body: JSON.stringify({ companyId: activeCompanyId }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp-qr-status", activeCompanyId] }),
  });

  const currentStatus = status.data?.status ?? "idle";

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Empresa real</h2>
        <p className="mt-1 text-sm text-slate-500">Selecione a empresa que sera vinculada ao numero escaneado.</p>

        {canCreateCompany && <div className="mt-5 space-y-3">
          <label htmlFor="real-company-name" className="sr-only">Nome da empresa real</label>
          <input
            id="real-company-name"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="Nome da empresa real"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
          <label htmlFor="assistant-name" className="sr-only">Nome da atendente IA</label>
          <input
            id="assistant-name"
            value={assistantName}
            onChange={(event) => setAssistantName(event.target.value)}
            placeholder="Nome da atendente IA"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
          <button
            onClick={() => createCompany.mutate()}
            disabled={createCompany.isPending}
            className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Criar empresa real
          </button>
          {createCompany.error && <p className="text-sm text-red-700" role="alert">{createCompany.error.message}</p>}
        </div>}

        <div className="mt-6">
          <label htmlFor="selected-company" className="mb-2 block text-sm font-semibold text-slate-700">Empresa selecionada</label>
          <select
            id="selected-company"
            value={activeCompanyId}
            onChange={(event) => setSelectedCompanyId(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
          >
            {(companies.data ?? []).map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Conectar WhatsApp por QR Code</h2>
            <p className="mt-1 text-sm text-slate-500">Abra o WhatsApp no celular, toque em Aparelhos conectados e escaneie o QR.</p>
          </div>
          <div role="status" aria-live="polite" aria-atomic="true">
            <StatusBadge label={currentStatus} tone={currentStatus === "connected" ? "green" : currentStatus === "error" ? "red" : "amber"} />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() => start.mutate()}
            disabled={!activeCompanyId || start.isPending}
            className="rounded-full bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            Gerar QR Code
          </button>
          <button
            onClick={() => disconnect.mutate()}
            disabled={!activeCompanyId || disconnect.isPending}
            className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Desconectar
          </button>
          <a href="/atendimento" className="rounded-full border border-emerald-300 px-5 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">
            Abrir atendimento
          </a>
        </div>

        <div className="mt-6 grid place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
          {status.data?.qrCodeDataUrl ? (
            <img src={status.data.qrCodeDataUrl} alt="QR Code do WhatsApp" className="h-80 w-80 rounded-xl bg-white p-3 shadow-sm" />
          ) : currentStatus === "connected" ? (
            <div className="text-center" role="status" aria-live="polite" aria-atomic="true">
              <p className="text-2xl font-bold text-emerald-700">WhatsApp conectado</p>
              <p className="mt-2 text-slate-500">Numero detectado: {status.data?.phoneNumber ?? "aguardando identificacao"}</p>
              <p className="mt-1 text-xs text-slate-400">
                Ultima verificacao: {status.data?.lastSuccessfulHealthCheckAt ? new Date(status.data.lastSuccessfulHealthCheckAt).toLocaleString("pt-BR") : "aguardando"}
              </p>
            </div>
          ) : currentStatus === "stale" ? (
            <div className="text-center" role="alert" aria-live="assertive" aria-atomic="true">
              <p className="text-2xl font-bold text-amber-900">Conexao sem confirmacao</p>
              <p className="mt-2 text-slate-500">O servidor nao conseguiu confirmar que o WhatsApp continua conectado.</p>
              <p className="mt-1 text-xs text-slate-400">
                Ultima verificacao OK: {status.data?.lastSuccessfulHealthCheckAt ? new Date(status.data.lastSuccessfulHealthCheckAt).toLocaleString("pt-BR") : "nenhuma"}
              </p>
            </div>
          ) : (
            <div className="text-center text-slate-500" role="status" aria-live="polite" aria-atomic="true">
              <p className="font-semibold">Nenhum QR ativo.</p>
              <p className="text-sm">Clique em Gerar QR Code para iniciar a conexao real.</p>
            </div>
          )}
        </div>

        {(start.error || disconnect.error || status.data?.lastError) && (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
            {start.error?.message ?? disconnect.error?.message ?? status.data?.lastError}
          </p>
        )}

        <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
          Para IA responder automaticamente em cenario real, configure uma chave OpenAI em `.env` ou no endpoint de configuracao. Sem chave, as mensagens reais chegam na central e podem ser assumidas manualmente.
        </div>
      </section>
    </div>
  );
}
