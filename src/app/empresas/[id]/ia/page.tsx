import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AgentPersonaForm } from "@/components/ai-config/AgentPersonaForm";
import { getCurrentAuth } from "@/services/server-auth.service";

export const dynamic = "force-dynamic";

export default async function EmpresaIAPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getCurrentAuth();
  if (auth.type === "company_user" && !auth.session.companyIds.includes(id)) notFound();
  const company = await prisma.company.findUnique({ where: { id }, include: { assistant: true } });
  if (!company?.assistant) notFound();
  const assistant = company.assistant;
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl p-4 md:p-5">
        <h1 className="text-3xl font-bold text-slate-900">IA da {company.name}</h1>
        <p className="mb-6 text-slate-500">Configure o agente como um atendente dedicado do estabelecimento.</p>
        <div className="mb-8 grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">Resumo atual da atendente</h2>
            <dl className="space-y-3 text-sm">
              <div><dt className="font-semibold text-slate-500">Nome</dt><dd>{assistant.name}</dd></div>
              <div><dt className="font-semibold text-slate-500">Funcao</dt><dd>{assistant.role}</dd></div>
              <div><dt className="font-semibold text-slate-500">Saudacao</dt><dd>{assistant.greetingMessage}</dd></div>
              <div><dt className="font-semibold text-slate-500">Encerramento</dt><dd>{assistant.closingMessage}</dd></div>
            </dl>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">Personalidade</h2>
            <p className="text-sm text-slate-600">{assistant.personality}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <StatusBadge label={`Formalidade ${assistant.formalityLevel}/5`} />
              <StatusBadge label={`Simpatia ${assistant.friendlinessLevel}/5`} />
              <StatusBadge label={`Objetividade ${assistant.objectivityLevel}/5`} />
              <StatusBadge label={`Comercial ${assistant.commercialLevel}/5`} />
              <StatusBadge label={`Detalhe ${assistant.detailLevel}/5`} />
              <StatusBadge label={`Emojis ${assistant.useEmojis ? "sim" : "nao"}`} />
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">Regras</h2>
            <p className="text-sm"><strong>Obrigatorias:</strong> {assistant.mandatoryRules}</p>
            <p className="mt-3 text-sm"><strong>Proibidas:</strong> {assistant.forbiddenRules}</p>
            <p className="mt-3 text-sm"><strong>Chamar humano:</strong> {assistant.humanEscalationRules}</p>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">Motor de IA</h2>
            <div className="space-y-2 text-sm text-slate-700">
              <p>Provedor ativo: <strong>{company.aiProvider === "openrouter" ? "OpenRouter" : "OpenAI"}</strong></p>
              <p>Modelo principal: <strong>{company.defaultAiModel ?? "gpt-4o-mini"}</strong></p>
              <p>Modelo OpenRouter: <strong>{company.openRouterModel ?? "padrao"}</strong></p>
              <p>Modelo fallback: <strong>{company.fallbackAiModel ?? "padrao"}</strong></p>
              <p>Embeddings: <strong>{company.embeddingModel ?? "text-embedding-3-small"}</strong></p>
              <p>Temperatura: <strong>{assistant.temperature}</strong></p>
              <p>Max tokens: <strong>{assistant.maxTokens}</strong></p>
              <p>Chave: <strong>{company.useOwnOpenAiKey ? "Individual da empresa" : "Geral"}</strong></p>
              <p>Limite diario: <strong>{company.dailyMessageLimit ?? "sem limite"}</strong></p>
              <p>Limite mensal: <strong>{company.monthlyMessageLimit ?? "sem limite"}</strong></p>
            </div>
          </section>
        </div>

        <AgentPersonaForm company={company} assistant={assistant} />
      </div>
    </AppShell>
  );
}
