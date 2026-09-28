"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { CompanyDTO } from "@/components/chat/types";
import { StatusBadge } from "@/components/ui/StatusBadge";

type ModuleType = "campaigns" | "automations" | "integrations" | "governance";

type TemplateDTO = {
  id: string;
  companyId: string;
  name: string;
  category: string;
  language: string;
  status: string;
  body: string;
  variables: string[];
};

type CampaignDTO = {
  id: string;
  name: string;
  status: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  scheduledAt?: string | null;
  template?: TemplateDTO | null;
  _count?: { recipients: number };
};

type AutomationDTO = {
  id: string;
  name: string;
  triggerKey: string;
  enabled: boolean;
  delayMinutes: number;
  actionPayload?: { message?: string } | null;
  lastRunAt?: string | null;
  _count?: { runs: number };
};

type IntegrationDTO = {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  secretMasked?: string;
  lastDeliveryAt?: string | null;
  lastError?: string | null;
};

type GovernanceLogDTO = {
  id: string;
  provider: string;
  model: string;
  status: string;
  fallbackUsed: boolean;
  needsHumanReview: boolean;
  latencyMs?: number | null;
  promptPreview?: string | null;
  responsePreview?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  company?: { name: string };
  conversation?: { customerName?: string | null; customerPhone: string } | null;
};

const moduleCopy = {
  campaigns: {
    title: "Campanhas WhatsApp",
    eyebrow: "Crescimento",
    description: "Crie templates, carregue contatos manualmente e dispare campanhas com rastreio por destinatario.",
  },
  automations: {
    title: "Automacoes de follow-up",
    eyebrow: "Operacao",
    description: "Configure mensagens automaticas para conversas paradas ou aguardando revisao humana.",
  },
  integrations: {
    title: "Integracoes e webhooks",
    eyebrow: "Conectores",
    description: "Cadastre endpoints externos para receber eventos da Cognita com assinatura opcional.",
  },
  governance: {
    title: "Governanca da IA",
    eyebrow: "Confianca",
    description: "Audite modelo, resposta, fontes, fallback e revisao humana das respostas geradas pela IA.",
  },
} satisfies Record<ModuleType, { title: string; eyebrow: string; description: string }>;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!response.ok) throw new Error((await response.json()).error ?? "Erro na requisicao");
  return response.json();
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString("pt-BR") : "-";
}

function sectionClass() {
  return "rounded-3xl border border-slate-200 bg-white p-5 shadow-sm";
}

export function GrowthModulesPanel({ moduleType }: { moduleType: ModuleType }) {
  const copy = moduleCopy[moduleType];
  const [companies, setCompanies] = useState<CompanyDTO[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [templates, setTemplates] = useState<TemplateDTO[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignDTO[]>([]);
  const [automations, setAutomations] = useState<AutomationDTO[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationDTO[]>([]);
  const [governanceLogs, setGovernanceLogs] = useState<GovernanceLogDTO[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [templateForm, setTemplateForm] = useState({ name: "promocao_whatsapp", body: "Oi {{name}}, tudo bem? Temos uma novidade para voce. Posso te mandar os detalhes?" });
  const [campaignForm, setCampaignForm] = useState({ name: "Campanha WhatsApp", templateId: "", contactsText: "5511999999999;Cliente teste" });
  const [automationForm, setAutomationForm] = useState({ name: "Follow-up de conversa parada", triggerKey: "INACTIVE_OPEN_CONVERSATION", delayMinutes: 60, message: "Oi! Passando para saber se voce ainda precisa de ajuda por aqui." });
  const [integrationForm, setIntegrationForm] = useState({ name: "Webhook principal", url: "https://example.com/webhook", events: "message.created, conversation.updated", secret: "" });

  const selectedCompany = useMemo(() => companies.find((company) => company.id === selectedCompanyId), [companies, selectedCompanyId]);

  async function loadData(companyId = selectedCompanyId) {
    if (!companyId) return;
    setIsLoading(true);
    try {
      if (moduleType === "campaigns") {
        const [templateData, campaignData] = await Promise.all([
          api<TemplateDTO[]>(`/api/whatsapp-templates?companyId=${companyId}`),
          api<CampaignDTO[]>(`/api/campaigns?companyId=${companyId}`),
        ]);
        setTemplates(templateData);
        setCampaigns(campaignData);
        setCampaignForm((current) => ({ ...current, templateId: current.templateId || templateData[0]?.id || "" }));
      }
      if (moduleType === "automations") setAutomations(await api<AutomationDTO[]>(`/api/automations?companyId=${companyId}`));
      if (moduleType === "integrations") setIntegrations(await api<IntegrationDTO[]>(`/api/integrations?companyId=${companyId}`));
      if (moduleType === "governance") setGovernanceLogs(await api<GovernanceLogDTO[]>(`/api/ai-governance?companyId=${companyId}`));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao carregar dados");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void api<CompanyDTO[]>("/api/companies")
      .then((data) => {
        if (!active) return;
        setCompanies(data);
        setSelectedCompanyId((current) => current || data[0]?.id || "");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Erro ao carregar empresas"));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedCompanyId) return;
    let active = true;
    void Promise.resolve().then(async () => {
      setIsLoading(true);
      try {
        if (moduleType === "campaigns") {
          const [templateData, campaignData] = await Promise.all([
            api<TemplateDTO[]>(`/api/whatsapp-templates?companyId=${selectedCompanyId}`),
            api<CampaignDTO[]>(`/api/campaigns?companyId=${selectedCompanyId}`),
          ]);
          if (!active) return;
          setTemplates(templateData);
          setCampaigns(campaignData);
          setCampaignForm((current) => ({ ...current, templateId: current.templateId || templateData[0]?.id || "" }));
        }
        if (moduleType === "automations") {
          const data = await api<AutomationDTO[]>(`/api/automations?companyId=${selectedCompanyId}`);
          if (active) setAutomations(data);
        }
        if (moduleType === "integrations") {
          const data = await api<IntegrationDTO[]>(`/api/integrations?companyId=${selectedCompanyId}`);
          if (active) setIntegrations(data);
        }
        if (moduleType === "governance") {
          const data = await api<GovernanceLogDTO[]>(`/api/ai-governance?companyId=${selectedCompanyId}`);
          if (active) setGovernanceLogs(data);
        }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Erro ao carregar dados");
      } finally {
        if (active) setIsLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [selectedCompanyId, moduleType]);

  async function createTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCompanyId) return;
    try {
      await api("/api/whatsapp-templates", { method: "POST", body: JSON.stringify({ companyId: selectedCompanyId, ...templateForm, variables: ["name"], status: "DRAFT" }) });
      setMessage("Template criado.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao criar template");
    }
  }

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCompanyId) return;
    try {
      await api("/api/campaigns", { method: "POST", body: JSON.stringify({ companyId: selectedCompanyId, ...campaignForm, templateId: campaignForm.templateId || null }) });
      setMessage("Campanha criada em rascunho.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao criar campanha");
    }
  }

  async function launchCampaign(id: string) {
    try {
      await api(`/api/campaigns/${id}/launch`, { method: "POST" });
      setMessage("Campanha disparada para a fila de envio.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao disparar campanha");
    }
  }

  async function createAutomation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCompanyId) return;
    try {
      await api("/api/automations", { method: "POST", body: JSON.stringify({ companyId: selectedCompanyId, ...automationForm }) });
      setMessage("Automacao criada.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao criar automacao");
    }
  }

  async function runAutomations() {
    if (!selectedCompanyId) return;
    try {
      const result = await api<{ created: number }>("/api/automations/run-due", { method: "POST", body: JSON.stringify({ companyId: selectedCompanyId }) });
      setMessage(`${result.created} follow-ups enviados ou enfileirados.`);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao executar automacoes");
    }
  }

  async function createIntegration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCompanyId) return;
    try {
      await api("/api/integrations", { method: "POST", body: JSON.stringify({ companyId: selectedCompanyId, ...integrationForm, events: integrationForm.events.split(",").map((eventName) => eventName.trim()).filter(Boolean) }) });
      setMessage("Integracao criada.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao criar integracao");
    }
  }

  async function testIntegration(id: string) {
    try {
      await api(`/api/integrations/${id}/test`, { method: "POST" });
      setMessage("Teste entregue ao webhook.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao testar webhook");
    }
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-xl shadow-slate-200 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-sky-300">{copy.eyebrow}</p>
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-black tracking-tight md:text-4xl">{copy.title}</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">{copy.description}</p>
            </div>
            <select value={selectedCompanyId} onChange={(event) => setSelectedCompanyId(event.target.value)} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white outline-none">
              {companies.map((company) => <option key={company.id} value={company.id} className="text-slate-900">{company.name}</option>)}
            </select>
          </div>
        </header>

        {message && <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900">{message}</div>}
        {isLoading && <div className="text-sm font-semibold text-slate-500">Carregando dados de {selectedCompany?.name ?? "empresa"}...</div>}

        {moduleType === "campaigns" && (
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <section className={sectionClass()}>
              <h3 className="text-lg font-black text-slate-900">Templates</h3>
              <form onSubmit={createTemplate} className="mt-4 space-y-3">
                <input value={templateForm.name} onChange={(event) => setTemplateForm({ ...templateForm, name: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400" placeholder="Nome do template" />
                <textarea value={templateForm.body} onChange={(event) => setTemplateForm({ ...templateForm, body: event.target.value })} className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400" placeholder="Mensagem com {{name}}" />
                <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800">Criar template</button>
              </form>
              <div className="mt-5 space-y-3">
                {templates.map((template) => <div key={template.id} className="rounded-2xl bg-slate-50 p-3 text-sm"><div className="flex items-center justify-between gap-2"><strong>{template.name}</strong><StatusBadge label={template.status} tone="blue" /></div><p className="mt-2 text-slate-500">{template.body}</p></div>)}
              </div>
            </section>
            <section className={sectionClass()}>
              <h3 className="text-lg font-black text-slate-900">Campanhas</h3>
              <form onSubmit={createCampaign} className="mt-4 space-y-3">
                <input value={campaignForm.name} onChange={(event) => setCampaignForm({ ...campaignForm, name: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400" placeholder="Nome da campanha" />
                <select value={campaignForm.templateId} onChange={(event) => setCampaignForm({ ...campaignForm, templateId: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400">
                  <option value="">Selecione um template</option>
                  {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
                <textarea value={campaignForm.contactsText} onChange={(event) => setCampaignForm({ ...campaignForm, contactsText: event.target.value })} className="min-h-32 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400" placeholder="Um contato por linha: 5511999999999;Maria" />
                <button className="rounded-2xl bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800">Criar campanha</button>
              </form>
              <div className="mt-5 space-y-3">
                {campaigns.map((campaign) => <div key={campaign.id} className="rounded-2xl border border-slate-100 p-4 text-sm"><div className="flex items-center justify-between gap-2"><strong>{campaign.name}</strong><StatusBadge label={campaign.status} tone={campaign.status === "COMPLETED" ? "green" : "amber"} /></div><p className="mt-2 text-slate-500">{campaign.template?.name ?? "Sem template"} · {campaign._count?.recipients ?? campaign.totalRecipients} contatos · {campaign.sentCount} enviados · {campaign.failedCount} falhas</p><button onClick={() => launchCampaign(campaign.id)} className="mt-3 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">Disparar agora</button></div>)}
              </div>
            </section>
          </div>
        )}

        {moduleType === "automations" && (
          <section className={sectionClass()}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><h3 className="text-lg font-black text-slate-900">Regras de follow-up</h3><button onClick={runAutomations} className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700">Executar pendentes</button></div>
            <form onSubmit={createAutomation} className="mt-4 grid gap-3 md:grid-cols-2">
              <input value={automationForm.name} onChange={(event) => setAutomationForm({ ...automationForm, name: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400" placeholder="Nome" />
              <select value={automationForm.triggerKey} onChange={(event) => setAutomationForm({ ...automationForm, triggerKey: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400">
                <option value="INACTIVE_OPEN_CONVERSATION">Conversa aberta inativa</option>
                <option value="WAITING_HUMAN_REVIEW">Aguardando humano</option>
              </select>
              <input type="number" min="1" value={automationForm.delayMinutes} onChange={(event) => setAutomationForm({ ...automationForm, delayMinutes: Number(event.target.value) })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400" />
              <input value={automationForm.message} onChange={(event) => setAutomationForm({ ...automationForm, message: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400" placeholder="Mensagem" />
              <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 md:col-span-2">Criar automacao</button>
            </form>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {automations.map((rule) => <div key={rule.id} className="rounded-2xl bg-slate-50 p-4 text-sm"><div className="flex items-center justify-between"><strong>{rule.name}</strong><StatusBadge label={rule.enabled ? "Ativa" : "Pausada"} tone={rule.enabled ? "green" : "slate"} /></div><p className="mt-2 text-slate-500">{rule.triggerKey} · {rule.delayMinutes} min · {rule._count?.runs ?? 0} execucoes</p><p className="mt-2 text-slate-700">{rule.actionPayload?.message}</p></div>)}
            </div>
          </section>
        )}

        {moduleType === "integrations" && (
          <section className={sectionClass()}>
            <h3 className="text-lg font-black text-slate-900">Endpoints externos</h3>
            <form onSubmit={createIntegration} className="mt-4 grid gap-3 md:grid-cols-2">
              <input value={integrationForm.name} onChange={(event) => setIntegrationForm({ ...integrationForm, name: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400" placeholder="Nome" />
              <input value={integrationForm.url} onChange={(event) => setIntegrationForm({ ...integrationForm, url: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400" placeholder="https://..." />
              <input value={integrationForm.events} onChange={(event) => setIntegrationForm({ ...integrationForm, events: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400" placeholder="Eventos separados por virgula" />
              <input value={integrationForm.secret} onChange={(event) => setIntegrationForm({ ...integrationForm, secret: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400" placeholder="Segredo opcional" />
              <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 md:col-span-2">Criar integracao</button>
            </form>
            <div className="mt-5 space-y-3">
              {integrations.map((endpoint) => <div key={endpoint.id} className="rounded-2xl border border-slate-100 p-4 text-sm"><div className="flex items-center justify-between"><strong>{endpoint.name}</strong><StatusBadge label={endpoint.active ? "Ativo" : "Inativo"} tone={endpoint.active ? "green" : "slate"} /></div><p className="mt-2 break-all text-slate-500">{endpoint.url}</p><p className="mt-1 text-slate-500">Eventos: {endpoint.events.join(", ")} · Ultimo teste: {formatDate(endpoint.lastDeliveryAt)}</p>{endpoint.lastError && <p className="mt-1 text-red-600">Erro: {endpoint.lastError}</p>}<button onClick={() => testIntegration(endpoint.id)} className="mt-3 rounded-xl bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-800">Testar webhook</button></div>)}
            </div>
          </section>
        )}

        {moduleType === "governance" && (
          <section className={sectionClass()}>
            <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-black text-slate-900">Ultimas respostas auditadas</h3><button onClick={() => loadData()} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Atualizar</button></div>
            <div className="mt-5 space-y-3">
              {governanceLogs.map((log) => <article key={log.id} className="rounded-2xl border border-slate-100 p-4 text-sm"><div className="flex flex-wrap items-center gap-2"><strong>{log.company?.name}</strong><StatusBadge label={log.status} tone={log.status === "success" ? "green" : log.status.startsWith("fallback") ? "amber" : "red"} />{log.needsHumanReview && <StatusBadge label="Revisao humana" tone="red" />}{log.fallbackUsed && <StatusBadge label="Fallback" tone="amber" />}</div><p className="mt-2 text-xs text-slate-500">{formatDate(log.createdAt)} · {log.provider}/{log.model} · {log.latencyMs ?? 0} ms · {log.conversation?.customerName ?? log.conversation?.customerPhone ?? "Sem conversa"}</p>{log.responsePreview && <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-slate-700">{log.responsePreview}</p>}{log.errorMessage && <p className="mt-2 text-red-600">{log.errorMessage}</p>}</article>)}
              {!governanceLogs.length && <p className="text-sm text-slate-500">Nenhum log de IA registrado ainda.</p>}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
