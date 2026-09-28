"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { CompanyDTO } from "@/components/chat/types";

type CompanyListItem = CompanyDTO & {
  _count?: { conversations: number; knowledgeItems: number };
  trainingCount?: number;
};

async function api<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error((await response.json()).error ?? "Erro na requisicao");
  return response.json();
}

function whatsappStatusLabel(status: string, sessionEnabled: boolean) {
  if (status === "CONNECTED") return "WhatsApp conectado";
  if (status === "STALE") return "Conexao sem confirmacao";
  if (status === "RESTORING") return "WhatsApp restaurando";
  if (status === "CONNECTING") return "WhatsApp conectando";
  if (status === "QR_REQUIRED") return "QR pendente";
  if (status === "LOGGED_OUT") return "WhatsApp desconectado";
  if (status === "ERROR") return "Erro no WhatsApp";
  if (sessionEnabled) return "Sessao salva";
  return "WhatsApp desconectado";
}

function whatsappStatusTone(status: string, sessionEnabled: boolean): "green" | "amber" | "red" | "blue" | "slate" {
  if (status === "CONNECTED") return "green";
  if (["RESTORING", "CONNECTING", "QR_REQUIRED", "STALE"].includes(status)) return "amber";
  if (["LOGGED_OUT", "ERROR", "DISCONNECTED"].includes(status)) return "red";
  if (sessionEnabled) return "blue";
  return "slate";
}

function formatStatusTime(value?: string | Date | null) {
  if (!value) return "sem verificacao recente";
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function CompaniesList({ initialCompanies }: { initialCompanies: CompanyListItem[] }) {
  const companies = useQuery({
    queryKey: ["companies", "empresas-page"],
    queryFn: () => api<CompanyListItem[]>("/api/companies"),
    initialData: initialCompanies,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
  const lastUiUpdate = companies.dataUpdatedAt ? new Date(companies.dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "aguardando";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
        <span>Status WhatsApp verificado automaticamente a cada 5 segundos.</span>
        <span>{companies.isFetching ? "Atualizando status..." : `Ultima atualizacao da tela: ${lastUiUpdate}`}</span>
      </div>
      {companies.error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{companies.error.message}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {(companies.data ?? []).map((company) => (
          <Link key={company.id} href={`/empresas/${company.id}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-emerald-300">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-900">{company.name}</h2>
              <div className="flex flex-wrap justify-end gap-2">
                <StatusBadge label={company.aiEnabled ? "IA ativa" : "IA pausada"} tone={company.aiEnabled ? "green" : "red"} />
                <StatusBadge
                  label={whatsappStatusLabel(company.whatsappConnectionStatus ?? "DISCONNECTED", Boolean(company.whatsappSessionEnabled))}
                  tone={whatsappStatusTone(company.whatsappConnectionStatus ?? "DISCONNECTED", Boolean(company.whatsappSessionEnabled))}
                />
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-500">{company.description}</p>
            <p className="mt-2 text-xs text-slate-500">
              Numero WhatsApp: {company.whatsappNumber ?? "nao vinculado"}
              {` • status verificado: ${formatStatusTime(company.whatsappLastSeenAt)}`}
            </p>
            {company.whatsappLastError && (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">Erro WhatsApp: {company.whatsappLastError}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge label={`${company._count?.conversations ?? 0} conversas`} />
              <StatusBadge label={`${company._count?.knowledgeItems ?? 0} conhecimentos`} />
              <StatusBadge label={`${company.trainingCount ?? 0} treinamentos`} tone="amber" />
              <StatusBadge label={company.assistant?.name ?? "Sem IA"} tone="blue" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
