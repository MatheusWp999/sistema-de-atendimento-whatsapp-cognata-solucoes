import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CompanyInlineTab } from "@/components/ai-config/CompanyInlineTab";
import { getCurrentAuth } from "@/services/server-auth.service";

export const dynamic = "force-dynamic";

const permanentTypes = [
  "Identidade e persona da IA",
  "Regras de atendimento",
  "Politica interna",
  "Informacao juridica",
  "Treinamento",
  "Script comercial",
  "Objecoes e respostas",
  "Informacoes da empresa",
  "Atividades da empresa",
];

function connectionTone(status: string): "green" | "amber" | "red" | "slate" {
  if (status === "CONNECTED") return "green";
  if (["CONNECTING", "RESTORING", "QR_REQUIRED", "STALE"].includes(status)) return "amber";
  if (["ERROR", "LOGGED_OUT"].includes(status)) return "red";
  return "slate";
}

function connectionLabel(status: string) {
  if (status === "CONNECTED") return "WhatsApp conectado";
  if (status === "STALE") return "Conexao sem confirmacao";
  if (status === "RESTORING") return "Restaurando WhatsApp";
  if (status === "CONNECTING") return "Conectando WhatsApp";
  if (status === "QR_REQUIRED") return "QR pendente";
  if (status === "LOGGED_OUT") return "Desconectado";
  if (status === "ERROR") return "Erro no WhatsApp";
  return "WhatsApp nao conectado";
}

function activeKeyStatus(input: {
  provider: string;
  useOwnOpenAiKey: boolean;
  hasOwnOpenAiKey: boolean;
  useOwnOpenRouterKey: boolean;
  hasOwnOpenRouterKey: boolean;
  hasGlobalOpenAi: boolean;
  hasGlobalOpenRouter: boolean;
}) {
  if (input.provider === "openrouter") {
    if (input.useOwnOpenRouterKey && input.hasOwnOpenRouterKey) return { label: "OpenRouter individual", tone: "green" as const };
    if (input.useOwnOpenRouterKey && !input.hasOwnOpenRouterKey) return { label: "OpenRouter sem chave", tone: "red" as const };
    return input.hasGlobalOpenRouter
      ? { label: "OpenRouter geral", tone: "blue" as const }
      : { label: "OpenRouter geral ausente", tone: "red" as const };
  }

  if (input.useOwnOpenAiKey && input.hasOwnOpenAiKey) return { label: "OpenAI individual", tone: "green" as const };
  if (input.useOwnOpenAiKey && !input.hasOwnOpenAiKey) return { label: "OpenAI sem chave", tone: "red" as const };
  return input.hasGlobalOpenAi
    ? { label: "OpenAI geral", tone: "blue" as const }
    : { label: "OpenAI geral ausente", tone: "red" as const };
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <strong className="block text-lg text-slate-900">{value}</strong>
      <span className="text-xs font-medium text-slate-500">{label}</span>
    </div>
  );
}

function ActionLink({ href, label, primary = false }: { href: string; label: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={primary
        ? "rounded-full bg-emerald-600 px-4 py-2 text-center text-sm font-bold text-white hover:bg-emerald-700"
        : "rounded-full border border-slate-200 px-4 py-2 text-center text-sm font-bold text-slate-700 hover:bg-slate-50"}
    >
      {label}
    </Link>
  );
}

export default async function ConfiguracoesIAPage() {
  const auth = await getCurrentAuth();
  const isAdmin = auth.type === "admin";
  const companyIds = auth.type === "company_user" ? auth.session.companyIds : undefined;
  const [companies, knowledgeCounts, typeCounts, openAiSetting, openRouterSetting] = await Promise.all([
    prisma.company.findMany({
      where: companyIds ? { id: { in: companyIds } } : undefined,
      include: {
        assistant: true,
        _count: { select: { conversations: true, knowledgeItems: true, usageLogs: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.knowledgeItem.groupBy({ by: ["companyId"], where: companyIds ? { companyId: { in: companyIds } } : undefined, _count: { id: true } }),
    prisma.knowledgeItem.groupBy({ by: ["companyId", "type"], where: companyIds ? { companyId: { in: companyIds } } : undefined, _count: { id: true } }),
    prisma.systemSetting.findUnique({ where: { key: "openai_global_key" } }),
    prisma.systemSetting.findUnique({ where: { key: "openrouter_global_key" } }),
  ]);

  const knowledgeByCompany = new Map(knowledgeCounts.map((item) => [item.companyId, item._count.id]));
  const countByCompanyAndType = new Map(typeCounts.map((item) => [`${item.companyId}:${item.type}`, item._count.id]));
  const hasGlobalOpenAi = Boolean(openAiSetting?.value || env.OPENAI_API_KEY);
  const hasGlobalOpenRouter = Boolean(openRouterSetting?.value || env.OPENROUTER_API_KEY);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl p-4 md:p-5">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Central de Agentes IA</h1>
            <p className="mt-2 max-w-3xl text-slate-500">
              Todas as configuracoes importantes dos agentes em um unico lugar: persona, motor, chaves, conhecimento, treinamentos e operacao WhatsApp.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin && <ActionLink href="/chaves-ia" label="Gerenciar chaves" primary />}
            <ActionLink href="/conhecimento/novo" label="Adicionar conhecimento" />
            <ActionLink href="/treinamentos" label="Treinamentos" />
          </div>
        </div>

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <Metric label="Empresas/agentes" value={companies.length} />
          <Metric label="Chave OpenAI geral" value={hasGlobalOpenAi ? "Configurada" : "Ausente"} />
          <Metric label="Chave OpenRouter geral" value={hasGlobalOpenRouter ? "Configurada" : "Ausente"} />
          <Metric label="Conteudos permanentes" value={typeCounts.filter((item) => permanentTypes.includes(item.type)).reduce((sum, item) => sum + item._count.id, 0)} />
        </section>

        <div className="space-y-5">
          {companies.map((company) => {
            const provider = company.aiProvider === "openrouter" ? "openrouter" : "openai";
            const activeModel = provider === "openrouter" ? company.openRouterModel || env.DEFAULT_OPENROUTER_MODEL : company.defaultAiModel || env.DEFAULT_AI_MODEL;
            const keyStatus = activeKeyStatus({
              provider,
              useOwnOpenAiKey: company.useOwnOpenAiKey,
              hasOwnOpenAiKey: Boolean(company.openAiApiKeyEncrypted),
              useOwnOpenRouterKey: company.useOwnOpenRouterKey,
              hasOwnOpenRouterKey: Boolean(company.openRouterApiKeyEncrypted),
              hasGlobalOpenAi,
              hasGlobalOpenRouter,
            });
            const personaCount = countByCompanyAndType.get(`${company.id}:Identidade e persona da IA`) ?? 0;
            const rulesCount = countByCompanyAndType.get(`${company.id}:Regras de atendimento`) ?? 0;
            const trainingCount = countByCompanyAndType.get(`${company.id}:Treinamento`) ?? 0;
            const scriptCount = countByCompanyAndType.get(`${company.id}:Script comercial`) ?? 0;

            return (
              <section key={company.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-bold text-slate-900">{company.assistant?.name ?? "Agente sem nome"}</h2>
                      <StatusBadge label={company.assistant?.enabled ? "Agente ativo" : "Agente inativo"} tone={company.assistant?.enabled ? "green" : "red"} />
                      <StatusBadge label={company.aiEnabled ? "IA da empresa ativa" : "IA da empresa pausada"} tone={company.aiEnabled ? "green" : "red"} />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{company.name} • {company.assistant?.role ?? "Funcao nao definida"}</p>
                    <p className="mt-3 max-w-3xl text-sm text-slate-600">{company.assistant?.personality ?? "Persona ainda nao configurada."}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ActionLink href={`/empresas/${company.id}/ia`} label="Editar persona" primary />
                    <ActionLink href={`/atendimento`} label="Atendimento" />
                  </div>
                </div>

                <CompanyInlineTab
                  company={{
                    id: company.id,
                    name: company.name,
                    description: company.description,
                    whatsappNumber: company.whatsappNumber,
                    notes: company.notes,
                    aiEnabled: company.aiEnabled,
                    whatsappConnectionStatus: company.whatsappConnectionStatus,
                    defaultAiModel: company.defaultAiModel,
                    openRouterModel: company.openRouterModel,
                    embeddingModel: company.embeddingModel,
                    dailyMessageLimit: company.dailyMessageLimit,
                    monthlyMessageLimit: company.monthlyMessageLimit,
                  }}
                />

                <div className="grid gap-4 p-5 xl:grid-cols-4">
                  <div className="rounded-2xl border border-slate-100 p-4">
                    <h3 className="font-bold text-slate-900">1. Persona e comportamento</h3>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <StatusBadge label={`Persona ${personaCount}`} tone={personaCount ? "green" : "amber"} />
                      <StatusBadge label={`Regras ${rulesCount}`} tone={rulesCount ? "green" : "amber"} />
                      <StatusBadge label={`Formal ${company.assistant?.formalityLevel ?? 3}/5`} />
                      <StatusBadge label={`Simpatia ${company.assistant?.friendlinessLevel ?? 3}/5`} />
                    </div>
                    <p className="mt-3 text-xs text-slate-500">Controla como o agente fala, se comporta, vende, coleta dados e encaminha para humano.</p>
                  </div>

                  <div className="rounded-2xl border border-slate-100 p-4">
                    <h3 className="font-bold text-slate-900">2. Motor e chaves</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusBadge label={provider === "openrouter" ? "OpenRouter" : "OpenAI"} tone={provider === "openrouter" ? "amber" : "green"} />
                      <StatusBadge label={keyStatus.label} tone={keyStatus.tone} />
                    </div>
                    <p className="mt-3 text-xs text-slate-500">Modelo ativo: <strong>{activeModel}</strong></p>
                    <p className="mt-1 text-xs text-slate-500">Embeddings/RAG: <strong>{company.embeddingModel || env.DEFAULT_EMBEDDING_MODEL}</strong></p>
                    {isAdmin && <div className="mt-3"><ActionLink href="/chaves-ia" label="Ajustar motor/chaves" /></div>}
                  </div>

                  <div className="rounded-2xl border border-slate-100 p-4">
                    <h3 className="font-bold text-slate-900">3. Conhecimento e treinamento</h3>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Metric label="Conhecimentos" value={knowledgeByCompany.get(company.id) ?? 0} />
                      <Metric label="Treinamentos" value={trainingCount} />
                      <Metric label="Scripts" value={scriptCount} />
                      <Metric label="Conversas" value={company._count.conversations} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ActionLink href="/conhecimento/novo" label="Novo conhecimento" />
                      <ActionLink href="/treinamentos" label="Treinar agente" />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 p-4">
                    <h3 className="font-bold text-slate-900">4. WhatsApp e operacao</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusBadge label={connectionLabel(company.whatsappConnectionStatus)} tone={connectionTone(company.whatsappConnectionStatus)} />
                    </div>
                    <p className="mt-3 text-xs text-slate-500">Numero: <strong>{company.whatsappNumber ?? "nao vinculado"}</strong></p>
                    <p className="mt-1 text-xs text-slate-500">Logs IA: <strong>{company._count.usageLogs}</strong></p>
                    {company.whatsappLastError && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{company.whatsappLastError}</p>}
                    <div className="mt-3"><ActionLink href="/whatsapp" label="Conexao WhatsApp" /></div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
