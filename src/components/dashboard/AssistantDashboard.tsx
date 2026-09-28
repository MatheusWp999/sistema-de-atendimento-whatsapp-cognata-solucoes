"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  Bot,
  Building2,
  Check,
  Edit3,
  MessageCircle,
  Mic,
  Palette,
  PlayCircle,
  Power,
  RefreshCw,
  Smartphone,
  Users,
  type LucideIcon,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type AssistantDTO = {
  id: string;
  name: string;
  role: string | null;
  personality: string;
  enabled: boolean;
};

type CompanyDTO = {
  id: string;
  name: string;
  aiEnabled: boolean;
  whatsappConnectionStatus: string;
  assistant: AssistantDTO | null;
};

type DashboardStats = {
  companies: number;
  conversations: number;
  aiActive: number;
  human: number;
  waiting: number;
  aiToday: number;
  costDay: number;
  costMonth: number;
};

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-violet-100 bg-violet-50/50 px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <strong className="mt-0.5 block text-sm text-slate-900">{value}</strong>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  href,
  icon: Icon,
  tall = false,
  badge,
  disabled = false,
}: {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tall?: boolean;
  badge?: string;
  disabled?: boolean;
}) {
  const className = `group relative flex rounded-xl border p-3.5 shadow-sm transition ${tall ? "h-full min-h-[260px] flex-col justify-end" : "min-h-[98px] flex-col justify-center"} ${disabled ? "border-slate-200 bg-slate-50 text-slate-400" : "border-violet-200 bg-white shadow-violet-50 hover:-translate-y-0.5 hover:shadow-md"}`;
  const content = (
    <>
      <div className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-lg border border-violet-100 text-violet-600 transition group-hover:bg-violet-50">
        <Edit3 size={13} />
      </div>
      <div className="flex items-center gap-2 pr-10">
        <Icon size={16} className={disabled ? "text-slate-400" : "text-slate-800"} />
        <h3 className="text-base font-extrabold text-slate-900">{title}</h3>
      </div>
      <p className="mt-2.5 max-w-[240px] text-[12px] leading-5 text-slate-700">{description}</p>
      {badge && <span className="absolute bottom-3 right-3 rounded-md bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white">{badge}</span>}
      {!disabled && !badge && <PlayCircle size={17} className="absolute bottom-3 right-3 text-violet-600 opacity-0 transition group-hover:opacity-100" />}
    </>
  );

  if (disabled) {
    return <div className={className} aria-disabled="true">{content}</div>;
  }

  return <Link href={href} className={className}>{content}</Link>;
}

async function parseApiError(response: Response, fallback: string) {
  const data = await response.json().catch(() => null) as { error?: string } | null;
  return data?.error ?? fallback;
}

export function AssistantDashboard({ companies: initialCompanies, initialStats }: { companies: CompanyDTO[]; initialStats: DashboardStats }) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanies[0]?.id ?? "");
  const [stats, setStats] = useState(initialStats);
  const [message, setMessage] = useState("");
  const [testResult, setTestResult] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedCompany = companies.find((company) => company.id === selectedCompanyId) ?? companies[0];
  const assistantName = selectedCompany?.assistant?.name || "Atendente IA";
  const assistantActive = Boolean(selectedCompany?.aiEnabled && (selectedCompany.assistant?.enabled ?? true));
  const whatsappConnected = selectedCompany?.whatsappConnectionStatus === "CONNECTED";

  useEffect(() => {
    if (!selectedCompanyId) return;
    void fetch(`/api/dashboard/stats?companyId=${encodeURIComponent(selectedCompanyId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(await parseApiError(response, "Erro ao carregar metricas"));
        return response.json() as Promise<DashboardStats>;
      })
      .then(setStats)
      .catch((error) => setMessage(error instanceof Error ? error.message : "Erro ao carregar metricas"));
  }, [selectedCompanyId]);

  function updateSelectedCompany(update: Partial<CompanyDTO> & { assistant?: AssistantDTO | null }) {
    if (!selectedCompany) return;
    setCompanies((current) => current.map((company) => company.id === selectedCompany.id ? { ...company, ...update } : company));
  }

  function toggleAssistant() {
    if (!selectedCompany) return;
    setMessage("");
    startTransition(async () => {
      const nextAiEnabled = !selectedCompany.aiEnabled;
      const response = await fetch(`/api/companies/${selectedCompany.id}/ai-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiEnabled: nextAiEnabled, resumeCompanyPausedConversations: nextAiEnabled }),
      });
      if (!response.ok) return setMessage(await parseApiError(response, "Erro ao alterar status da IA"));
      updateSelectedCompany({ aiEnabled: nextAiEnabled });
      setMessage(nextAiEnabled ? "Assistente ativado para novas mensagens." : "Assistente desativado e conversas assumidas por humano.");
    });
  }

  function resetAssistant() {
    if (!selectedCompany) return;
    if (!window.confirm("Resetar a persona do assistente desta empresa para o padrao?")) return;
    setMessage("");
    setTestResult("");
    startTransition(async () => {
      const response = await fetch(`/api/companies/${selectedCompany.id}/assistant/reset`, { method: "POST" });
      if (!response.ok) return setMessage(await parseApiError(response, "Erro ao resetar assistente"));
      const data = await response.json() as { assistant: AssistantDTO };
      updateSelectedCompany({ assistant: data.assistant });
      setMessage("Assistente resetado para a configuracao padrao.");
    });
  }

  function testAssistant() {
    if (!selectedCompany) return;
    setMessage("");
    setTestResult("");
    startTransition(async () => {
      const response = await fetch(`/api/companies/${selectedCompany.id}/assistant/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Ola, pode me explicar como voce pode ajudar?" }),
      });
      if (!response.ok) return setMessage(await parseApiError(response, "Erro ao testar assistente"));
      const data = await response.json() as { content?: string };
      setTestResult(data.content ?? "Teste executado sem resposta textual.");
    });
  }

  return (
    <div className="flex h-[calc(100vh-56px)] items-stretch justify-center overflow-hidden px-4 py-3 md:px-5">
      <section className="flex h-full w-full max-w-[1380px] flex-col overflow-y-auto rounded-2xl bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-extrabold text-slate-900">Assistente Virtual</h2>
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${assistantActive ? "border-green-200 bg-green-50 text-green-600" : "border-red-200 bg-red-50 text-red-600"}`}>
              <span className={`h-2 w-2 rounded-full ${assistantActive ? "bg-green-500" : "bg-red-500"}`} />
              {assistantActive ? "Online" : "Offline"}
            </span>
            {companies.length > 1 && (
              <select value={selectedCompanyId} onChange={(event) => setSelectedCompanyId(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
                {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            )}
          </div>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-extrabold ${assistantActive ? "border-slate-200 text-green-600" : "border-red-200 text-red-600"}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${assistantActive ? "bg-green-500" : "bg-red-500"}`} />
            ASSISTENTE: {assistantActive ? "ATIVO" : "INATIVO"}
          </span>
        </div>

        <div className="mt-3 rounded-xl bg-slate-100 px-4 py-4 md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-violet-600 text-white shadow-lg shadow-violet-200">
                <Bot size={44} strokeWidth={2.1} />
              </div>
              <div>
                <h3 className="text-lg font-extrabold leading-tight text-slate-900 md:text-xl">
                  Ola! Meu nome e <span className="font-black">{assistantName}</span>, assistente virtual da sua empresa!
                </h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {assistantActive ? "Estou fazendo atendimentos agora mesmo. Se quiser que eu pare, basta me desativar." : "Estou pausado. Ative o assistente para voltar a responder novas mensagens."}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button onClick={resetAssistant} disabled={!selectedCompany || isPending} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50">
                    <RefreshCw size={18} /> Resetar assistente
                  </button>
                  <button onClick={testAssistant} disabled={!selectedCompany || isPending} aria-label="Testar assistente" className="text-violet-600 hover:text-violet-700 disabled:opacity-50">
                    <PlayCircle size={21} />
                  </button>
                  <Link href="/atendimento" className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-800 shadow-sm hover:bg-slate-50">Abrir atendimento</Link>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/whatsapp" className={`rounded-xl p-2 ${whatsappConnected ? "text-green-600" : "text-violet-600"}`} aria-label="WhatsApp QR">
                <Smartphone size={24} />
              </Link>
              <button onClick={toggleAssistant} disabled={!selectedCompany || isPending} className={`inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-extrabold disabled:opacity-50 ${assistantActive ? "border-red-300 text-red-600 hover:bg-red-50" : "border-green-300 text-green-600 hover:bg-green-50"}`}>
                <Power size={20} /> {assistantActive ? "Desativar assistente" : "Ativar assistente"}
              </button>
            </div>
          </div>
          {(message || testResult) && (
            <div className="mt-3 rounded-xl bg-white p-3 text-sm text-slate-700 shadow-sm">
              {message && <p className="font-semibold">{message}</p>}
              {testResult && <p className="mt-1 leading-6"><strong>Resposta de teste:</strong> {testResult}</p>}
            </div>
          )}
        </div>

        <div className="mt-4 grid flex-1 gap-3 lg:grid-cols-[190px_1fr_1fr]">
          <FeatureCard title="Geral" description="Informacoes gerais da sua empresa" href="/regra-geral" icon={Building2} tall />

          <div className="grid gap-3 md:grid-cols-2">
            <FeatureCard title="Contato" description="Informacoes de contato da sua empresa" href={selectedCompany ? `/empresas/${selectedCompany.id}` : "/empresas"} icon={Building2} />
            <FeatureCard title="Personalizacao" description="Informacoes do assistente virtual da sua empresa" href={selectedCompany ? `/empresas/${selectedCompany.id}/ia` : "/configuracoes-ia"} icon={Palette} />
            <FeatureCard title="Filas de atend." description="Modulo de filas e SLA ainda sera desenvolvido" href="/atendimento" icon={Users} badge="Em breve" disabled />
            <FeatureCard title="Web Chat" description="Widget instalavel ainda sera desenvolvido" href="/atendimento" icon={MessageCircle} badge="Beta" disabled />
            <FeatureCard title="Whatsapp" description="Conexao do WhatsApp da sua empresa" href="/whatsapp" icon={Smartphone} />
            <FeatureCard title="Audio" description="Voz, transcricao e audio ainda serao desenvolvidos" href="/configuracoes-ia" icon={Mic} badge="Em breve" disabled />
          </div>

          <div className="flex flex-col rounded-xl border border-violet-200 bg-white p-4 shadow-sm shadow-violet-50">
            <div className="flex items-center gap-2">
              <Bot size={17} className="text-slate-700" />
              <h3 className="text-sm font-extrabold text-slate-900">Treinamento Avancado</h3>
            </div>
            <p className="mt-4 text-sm leading-5 text-slate-800">Nessa secao voce podera:</p>
            <ul className="mt-3 flex-1 space-y-1 text-[12px] text-slate-800">
              {[
                "Cadastrar quantas informacoes forem necessarias referente a sua empresa",
                "Cadastrar produtos e servicos",
                "Criar regras gerais",
                "Criar acoes",
                "Configurar envio de arquivos",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-violet-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link href="/treinamentos" className="mt-4 flex w-full items-center justify-center rounded-lg bg-orange-500 px-5 py-2.5 text-xs font-bold uppercase text-white hover:bg-orange-600">
              Meus treinamentos
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-8">
          <MiniMetric label="Empresas" value={stats.companies} />
          <MiniMetric label="Conversas" value={stats.conversations} />
          <MiniMetric label="IA ativa" value={stats.aiActive} />
          <MiniMetric label="Humano" value={stats.human} />
          <MiniMetric label="Aguardando" value={stats.waiting} />
          <MiniMetric label="IA hoje" value={stats.aiToday} />
          <MiniMetric label="Consumo dia" value={formatCurrency(stats.costDay)} />
          <MiniMetric label="Consumo mes" value={formatCurrency(stats.costMonth)} />
        </div>
      </section>
    </div>
  );
}
