"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type AssistantPersonaDTO = {
  id?: string;
  name?: string;
  role?: string | null;
  personality?: string;
  tone?: string | null;
  greetingMessage?: string | null;
  closingMessage?: string | null;
  formalityLevel?: number;
  friendlinessLevel?: number;
  objectivityLevel?: number;
  commercialLevel?: number;
  detailLevel?: number;
  responseSize?: string;
  useEmojis?: boolean;
  temperature?: number;
  maxTokens?: number;
  mandatoryRules?: string | null;
  forbiddenRules?: string | null;
  humanEscalationRules?: string | null;
  fallbackMessage?: string | null;
};

type CompanyPersonaDTO = {
  id: string;
  name: string;
  description?: string | null;
};

function Field({ label, children, help }: { label: string; children: React.ReactNode; help?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      {children}
      {help && <span className="mt-1 block text-xs text-slate-500">{help}</span>}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-emerald-500" />;
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-emerald-500" />;
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-700">{label}</span>
        <strong className="text-emerald-700">{value}/5</strong>
      </div>
      <input type="range" min={1} max={5} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full" />
    </div>
  );
}

export function AgentPersonaForm({ company, assistant }: { company: CompanyPersonaDTO; assistant: AssistantPersonaDTO | null }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: assistant?.name ?? "Atendente IA",
    role: assistant?.role ?? "Atendente do estabelecimento",
    personality: assistant?.personality ?? "Natural, profissional, acolhedora e segura.",
    tone: assistant?.tone ?? "Humano, claro e prestativo.",
    greetingMessage: assistant?.greetingMessage ?? `Ola! Sou a atendente da ${company.name}. Como posso ajudar?`,
    closingMessage: assistant?.closingMessage ?? "Fico a disposicao. Posso ajudar com mais alguma coisa?",
    establishmentContext: company.description ?? "",
    serviceRoutine: "",
    idealBehavior: "",
    neverDo: "",
    angryClientHandling: "",
    priceHandling: "",
    objectionHandling: "",
    dataCollection: "",
    humanHandoff: "",
    goodExamples: "",
    badExamples: "",
    mandatoryRules: assistant?.mandatoryRules ?? "Responder em portugues do Brasil. Nao inventar informacoes. Usar apenas informacoes da empresa atual.",
    forbiddenRules: assistant?.forbiddenRules ?? "Nao prometer descontos, aprovacoes, resultados ou condicoes especiais sem base cadastrada.",
    humanEscalationRules: assistant?.humanEscalationRules ?? "Chamar humano quando faltar informacao, houver tema sensivel, reclamacao, cancelamento, juridico ou pedido direto por atendente.",
    fallbackMessage: assistant?.fallbackMessage ?? "Para te passar essa informacao com seguranca, vou encaminhar sua conversa para um atendente responsavel.",
    formalityLevel: assistant?.formalityLevel ?? 3,
    friendlinessLevel: assistant?.friendlinessLevel ?? 3,
    objectivityLevel: assistant?.objectivityLevel ?? 3,
    commercialLevel: assistant?.commercialLevel ?? 3,
    detailLevel: assistant?.detailLevel ?? 3,
    responseSize: assistant?.responseSize ?? "medium",
    useEmojis: assistant?.useEmojis ?? false,
    temperature: assistant?.temperature ?? 0.4,
    maxTokens: assistant?.maxTokens ?? 700,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setError("");
    if (!form.name.trim()) return setError("Informe o nome do agente.");
    if (!form.personality.trim()) return setError("Informe a personalidade do agente.");
    setIsSaving(true);

    try {
      const response = await fetch(`/api/companies/${company.id}/agent-persona`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "Erro ao salvar persona");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro ao salvar persona");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
        <h2 className="text-xl font-bold">Persona dedicada do agente</h2>
        <p className="mt-2 text-sm leading-relaxed">
          Esta tela transforma o agente em um atendente do estabelecimento. Ao salvar, os campos estruturados da IA sao atualizados e uma persona permanente e criada na base da empresa.
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-bold text-slate-900">Identidade</h3>
          <div className="space-y-4">
            <Field label="Nome do agente"><TextInput value={form.name} onChange={(event) => update("name", event.target.value)} /></Field>
            <Field label="Cargo ou funcao"><TextInput value={form.role} onChange={(event) => update("role", event.target.value)} /></Field>
            <Field label="Personalidade principal"><TextArea rows={4} value={form.personality} onChange={(event) => update("personality", event.target.value)} /></Field>
            <Field label="Tom de voz"><TextArea rows={3} value={form.tone} onChange={(event) => update("tone", event.target.value)} /></Field>
            <Field label="Saudacao padrao"><TextArea rows={2} value={form.greetingMessage} onChange={(event) => update("greetingMessage", event.target.value)} /></Field>
            <Field label="Mensagem de encerramento"><TextArea rows={2} value={form.closingMessage} onChange={(event) => update("closingMessage", event.target.value)} /></Field>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-bold text-slate-900">Estilo de atendimento</h3>
          <div className="grid gap-3">
            <Slider label="Formalidade" value={form.formalityLevel} onChange={(value) => update("formalityLevel", value)} />
            <Slider label="Simpatia" value={form.friendlinessLevel} onChange={(value) => update("friendlinessLevel", value)} />
            <Slider label="Objetividade" value={form.objectivityLevel} onChange={(value) => update("objectivityLevel", value)} />
            <Slider label="Intensidade comercial" value={form.commercialLevel} onChange={(value) => update("commercialLevel", value)} />
            <Slider label="Detalhamento" value={form.detailLevel} onChange={(value) => update("detailLevel", value)} />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Tamanho das respostas">
              <select value={form.responseSize} onChange={(event) => update("responseSize", event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-black">
                <option value="curto">Curto</option>
                <option value="medium">Medio</option>
                <option value="detalhado">Detalhado</option>
              </select>
            </Field>
            <Field label="Uso de emojis">
              <select value={form.useEmojis ? "sim" : "nao"} onChange={(event) => update("useEmojis", event.target.value === "sim")} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-black">
                <option value="nao">Nao</option>
                <option value="sim">Sim</option>
              </select>
            </Field>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-bold text-slate-900">Contexto do estabelecimento</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Quem e o estabelecimento"><TextArea rows={5} value={form.establishmentContext} onChange={(event) => update("establishmentContext", event.target.value)} /></Field>
          <Field label="Rotina, atividades e tipo de atendimento"><TextArea rows={5} value={form.serviceRoutine} onChange={(event) => update("serviceRoutine", event.target.value)} /></Field>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-bold text-slate-900">Comportamento e limites</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Como o agente deve agir"><TextArea rows={5} value={form.idealBehavior} onChange={(event) => update("idealBehavior", event.target.value)} /></Field>
          <Field label="O que o agente nunca pode fazer"><TextArea rows={5} value={form.neverDo} onChange={(event) => update("neverDo", event.target.value)} /></Field>
          <Field label="Regras obrigatorias"><TextArea rows={5} value={form.mandatoryRules} onChange={(event) => update("mandatoryRules", event.target.value)} /></Field>
          <Field label="Regras proibidas"><TextArea rows={5} value={form.forbiddenRules} onChange={(event) => update("forbiddenRules", event.target.value)} /></Field>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-bold text-slate-900">Condução do atendimento</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Cliente irritado"><TextArea rows={4} value={form.angryClientHandling} onChange={(event) => update("angryClientHandling", event.target.value)} /></Field>
          <Field label="Preco e negociacao"><TextArea rows={4} value={form.priceHandling} onChange={(event) => update("priceHandling", event.target.value)} /></Field>
          <Field label="Objeções"><TextArea rows={4} value={form.objectionHandling} onChange={(event) => update("objectionHandling", event.target.value)} /></Field>
          <Field label="Dados que deve coletar"><TextArea rows={4} value={form.dataCollection} onChange={(event) => update("dataCollection", event.target.value)} /></Field>
          <Field label="Quando chamar humano"><TextArea rows={4} value={form.humanEscalationRules} onChange={(event) => update("humanEscalationRules", event.target.value)} /></Field>
          <Field label="Como encaminhar para humano"><TextArea rows={4} value={form.humanHandoff} onChange={(event) => update("humanHandoff", event.target.value)} /></Field>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-bold text-slate-900">Exemplos de atendimento</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Exemplos de boas respostas"><TextArea rows={6} value={form.goodExamples} onChange={(event) => update("goodExamples", event.target.value)} /></Field>
          <Field label="Exemplos de respostas ruins/proibidas"><TextArea rows={6} value={form.badExamples} onChange={(event) => update("badExamples", event.target.value)} /></Field>
        </div>
      </section>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="sticky bottom-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
        <button onClick={save} disabled={isSaving} className="rounded-full bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
          {isSaving ? "Salvando persona..." : "Salvar persona dedicada do agente"}
        </button>
      </div>
    </div>
  );
}
