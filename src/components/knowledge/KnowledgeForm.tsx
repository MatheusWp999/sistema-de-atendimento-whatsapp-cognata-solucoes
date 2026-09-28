"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CompanyDTO } from "@/components/chat/types";

const knowledgeTypes = [
  "Informacoes da empresa",
  "Identidade e persona da IA",
  "Atividades da empresa",
  "Texto manual",
  "FAQ",
  "Script comercial",
  "Treinamento",
  "Produto",
  "Servico",
  "Produtos e servicos",
  "Politica interna",
  "Objecoes e respostas",
  "Informacao financeira",
  "Informacao juridica",
  "Processos operacionais",
  "Regras de atendimento",
  "Outro",
];

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error((await response.json()).error ?? "Erro ao salvar conhecimento");
  return response.json();
}

export function KnowledgeForm({ companies, defaultType = "Texto manual" }: { companies: CompanyDTO[]; defaultType?: string }) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [sourceMode, setSourceMode] = useState<"text" | "pdf">("text");
  const [title, setTitle] = useState("");
  const [type, setType] = useState(defaultType);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedCompany = companies.find((company) => company.id === companyId);
  const permanentBehaviorTypes = new Set([
    "Identidade e persona da IA",
    "Regras de atendimento",
    "Politica interna",
    "Informacao juridica",
    "Treinamento",
    "Script comercial",
    "Objecoes e respostas",
    "Informacoes da empresa",
    "Atividades da empresa",
  ]);
  const usageMode = permanentBehaviorTypes.has(type) ? "Camada permanente do agente" : "Base factual recuperada por pergunta";

  async function submit() {
    setError("");
    if (!companyId) return setError("Selecione a empresa dona deste conhecimento.");
    if (!title.trim()) return setError("Informe um titulo.");
    if (sourceMode === "text" && !content.trim()) return setError("Informe o conteudo.");
    if (sourceMode === "pdf" && !file) return setError("Selecione um PDF.");

    setIsSaving(true);
    try {
      let item: { id: string };
      if (sourceMode === "pdf") {
        const formData = new FormData();
        formData.set("companyId", companyId);
        formData.set("title", title.trim());
        formData.set("type", type);
        formData.set("file", file as File);
        const response = await fetch("/api/knowledge/upload-pdf", { method: "POST", body: formData });
        if (!response.ok) throw new Error((await response.json()).error ?? "Erro ao processar PDF");
        item = await response.json();
      } else {
        item = await postJson<{ id: string }>("/api/knowledge", {
          companyId,
          title: title.trim(),
          type,
          content: content.trim(),
          sourceType: type === "Treinamento" ? "training" : "manual",
          active: true,
        });
      }
      router.push(`/conhecimento/${item.id}`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Erro ao salvar conhecimento");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <aside className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
        <h2 className="text-lg font-bold">Isolamento por empresa</h2>
        <p className="mt-2 text-sm leading-relaxed">
          Este conteudo sera salvo somente para a empresa selecionada abaixo. A IA de outras empresas nao conseguira consultar este treinamento ou conhecimento.
        </p>
        <p className="mt-3 text-sm leading-relaxed">
          Pode ser usado para PDFs de persona, atividades, produtos, servicos, processos, politicas, FAQs, treinamentos e informacoes institucionais.
        </p>
        <div className="mt-4 rounded-xl bg-white p-4 text-sm shadow-sm">
          <p className="font-semibold">Empresa selecionada</p>
          <p className="mt-1 text-xl font-bold text-emerald-700">{selectedCompany?.name ?? "Nenhuma"}</p>
        </div>
        <div className="mt-4 rounded-xl bg-white p-4 text-sm shadow-sm">
          <p className="font-semibold">Como a IA vai usar</p>
          <p className="mt-1 font-bold text-slate-900">{usageMode}</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Persona, regras e treinamentos entram sempre no prompt da empresa. Produtos, servicos, FAQ e demais informacoes sao buscados quando forem relevantes para a pergunta.
          </p>
        </div>
      </aside>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <span className="mb-3 block text-sm font-bold text-slate-700">Origem do conteudo *</span>
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setSourceMode("text")}
              className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold ${sourceMode === "text" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700"}`}
            >
              Texto manual
              <span className="mt-1 block text-xs font-normal">Cole ou digite o conhecimento diretamente.</span>
            </button>
            <button
              type="button"
              onClick={() => setSourceMode("pdf")}
              className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold ${sourceMode === "pdf" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700"}`}
            >
              PDF
              <span className="mt-1 block text-xs font-normal">Enviar PDF da empresa, persona, atividades ou treinamento.</span>
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">Empresa dona deste conhecimento *</span>
            <select
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-emerald-500"
            >
              <option value="">Selecione uma empresa</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">Tipo *</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-emerald-500"
            >
              {knowledgeTypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-4 block">
          <span className="mb-2 block text-sm font-bold text-slate-700">Titulo *</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex: Politica comercial da Empresa Alpha"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-emerald-500"
          />
        </label>

        {sourceMode === "text" ? (
          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-bold text-slate-700">Conteudo *</span>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Cole aqui persona, atividades, FAQ, politica, script, treinamento ou informacao que pertence exclusivamente a empresa selecionada."
              rows={14}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-emerald-500"
            />
          </label>
        ) : (
          <label className="mt-4 block rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
            <span className="mb-2 block text-sm font-bold text-slate-700">Arquivo PDF *</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-black file:mr-4 file:rounded-full file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
            <p className="mt-3 text-sm text-slate-600">
              O PDF sera salvo para <strong>{selectedCompany?.name ?? "a empresa selecionada"}</strong>, extraido em texto, dividido em chunks e usado somente nas conversas desta empresa.
            </p>
            {file && <p className="mt-2 text-sm font-semibold text-emerald-700">PDF selecionado: {file.name}</p>}
          </label>
        )}

        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <button
          onClick={submit}
          disabled={isSaving}
          className="mt-5 rounded-full bg-emerald-600 px-6 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {isSaving ? "Salvando..." : `Salvar para ${selectedCompany?.name ?? "empresa selecionada"}`}
        </button>
      </section>
    </div>
  );
}
