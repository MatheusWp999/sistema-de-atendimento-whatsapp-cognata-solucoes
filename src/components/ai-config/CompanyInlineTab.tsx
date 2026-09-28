"use client";

import { useState } from "react";

type CompanyInlineTabProps = {
  company: {
    id: string;
    name: string;
    description?: string | null;
    whatsappNumber?: string | null;
    notes?: string | null;
    aiEnabled: boolean;
    whatsappConnectionStatus: string;
    defaultAiModel?: string | null;
    openRouterModel?: string | null;
    embeddingModel?: string | null;
    dailyMessageLimit?: number | null;
    monthlyMessageLimit?: number | null;
  };
};

export function CompanyInlineTab({ company }: CompanyInlineTabProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`rounded-full px-4 py-2 text-sm font-bold ${
          isOpen ? "bg-emerald-600 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        {isOpen ? "Ocultar aba Empresa" : "Abrir aba Empresa"}
      </button>

      {isOpen && (
        <div className="mt-4 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-3">
          <section>
            <h3 className="font-bold text-slate-900">Dados da empresa</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div><dt className="font-semibold text-slate-500">Nome</dt><dd className="text-slate-900">{company.name}</dd></div>
              <div><dt className="font-semibold text-slate-500">WhatsApp</dt><dd className="text-slate-900">{company.whatsappNumber ?? "Nao vinculado"}</dd></div>
              <div><dt className="font-semibold text-slate-500">Status IA</dt><dd className="text-slate-900">{company.aiEnabled ? "Ativa" : "Pausada"}</dd></div>
              <div><dt className="font-semibold text-slate-500">Status WhatsApp</dt><dd className="text-slate-900">{company.whatsappConnectionStatus}</dd></div>
            </dl>
          </section>

          <section>
            <h3 className="font-bold text-slate-900">Contexto da empresa</h3>
            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              {company.description || "Sem descricao cadastrada."}
            </p>
            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              {company.notes || "Sem observacoes internas."}
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900">Operacao IA</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div><dt className="font-semibold text-slate-500">Modelo OpenAI</dt><dd className="text-slate-900">{company.defaultAiModel ?? "Padrao"}</dd></div>
              <div><dt className="font-semibold text-slate-500">Modelo OpenRouter</dt><dd className="text-slate-900">{company.openRouterModel ?? "Padrao"}</dd></div>
              <div><dt className="font-semibold text-slate-500">Embeddings</dt><dd className="text-slate-900">{company.embeddingModel ?? "Padrao"}</dd></div>
              <div><dt className="font-semibold text-slate-500">Limite diario</dt><dd className="text-slate-900">{company.dailyMessageLimit ?? "Sem limite"}</dd></div>
              <div><dt className="font-semibold text-slate-500">Limite mensal</dt><dd className="text-slate-900">{company.monthlyMessageLimit ?? "Sem limite"}</dd></div>
            </dl>
          </section>
        </div>
      )}
    </div>
  );
}
