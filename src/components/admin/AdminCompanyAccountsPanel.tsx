"use client";

import { FormEvent, useState, useTransition } from "react";
import Link from "next/link";
import { Bot, Building2, KeyRound, MessageCircle, Plus, ShieldCheck, Users, WalletCards } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ACCOUNT_STATUS, PLAN_OPTIONS, planLabel } from "@/services/account-approval.service";

type AdminCompany = {
  id: string;
  name: string;
  whatsappNumber?: string | null;
  whatsappConnectionStatus: string;
  accountStatus: string;
  planKey?: string | null;
  aiEnabled: boolean;
  assistant?: { name: string; enabled: boolean } | null;
  _count?: { conversations: number; knowledgeItems: number; usageLogs: number };
  memberships: Array<{ role: string; user: { id: string; name: string; email: string; role: string; active: boolean; lastLoginAt?: string | null } }>;
};

type AdminPayload = {
  stats: { companies: number; activeUsers: number; aiRequests: number; estimatedCost: number };
  companies: AdminCompany[];
};

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Building2 }) {
  return (
    <div className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm shadow-violet-50">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
        <Icon size={18} className="text-violet-600" />
      </div>
      <strong className="mt-2 block text-2xl text-slate-950">{value}</strong>
    </div>
  );
}

async function apiError(response: Response) {
  const payload = await response.json().catch(() => ({})) as { error?: string };
  return payload.error ?? "Erro inesperado";
}

export function AdminCompanyAccountsPanel({ initialData }: { initialData: AdminPayload }) {
  const [data, setData] = useState(initialData);
  const [form, setForm] = useState({ companyName: "", whatsappNumber: "", description: "", ownerName: "", ownerEmail: "", ownerPassword: "", planKey: "PROFESSIONAL" });
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function refresh() {
    const response = await fetch("/api/admin/company-accounts", { cache: "no-store" });
    if (!response.ok) throw new Error(await apiError(response));
    setData(await response.json() as AdminPayload);
  }

  function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/admin/company-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        setMessage(await apiError(response));
        return;
      }
      setForm({ companyName: "", whatsappNumber: "", description: "", ownerName: "", ownerEmail: "", ownerPassword: "", planKey: "PROFESSIONAL" });
      await refresh();
      setMessage("Conta empresarial criada com sucesso.");
    });
  }

  function updateCompanyAccess(companyId: string, payload: { accountStatus?: string; planKey?: string | null }) {
    setMessage("");
    startTransition(async () => {
      const response = await fetch(`/api/admin/company-accounts/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setMessage(await apiError(response));
        return;
      }
      await refresh();
      setMessage("Liberacao atualizada com sucesso.");
    });
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Empresas" value={data.stats.companies} icon={Building2} />
        <StatCard label="Usuarios ativos" value={data.stats.activeUsers} icon={Users} />
        <StatCard label="Requisicoes IA" value={data.stats.aiRequests} icon={Bot} />
        <StatCard label="Consumo total" value={formatCurrency(data.stats.estimatedCost)} icon={WalletCards} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[420px_1fr]">
        <form onSubmit={createAccount} className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm shadow-violet-50">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-violet-600 text-white"><Plus size={18} /></div>
            <div>
              <h2 className="text-xl font-black text-slate-950">Nova conta empresarial</h2>
              <p className="text-xs text-slate-500">Cria empresa, assistente padrao e usuario dono.</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <input value={form.companyName} onChange={(event) => update("companyName", event.target.value)} required placeholder="Nome da empresa" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500" />
            <input value={form.whatsappNumber} onChange={(event) => update("whatsappNumber", event.target.value)} placeholder="WhatsApp da empresa" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500" />
            <textarea value={form.description} onChange={(event) => update("description", event.target.value)} rows={3} placeholder="Resumo da empresa" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500" />
            <input value={form.ownerName} onChange={(event) => update("ownerName", event.target.value)} required placeholder="Nome do responsavel" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500" />
            <input value={form.ownerEmail} onChange={(event) => update("ownerEmail", event.target.value)} required type="email" placeholder="Email de login" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500" />
            <input value={form.ownerPassword} onChange={(event) => update("ownerPassword", event.target.value)} required type="password" minLength={8} placeholder="Senha inicial" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500" />
            <select value={form.planKey} onChange={(event) => update("planKey", event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500">
              {PLAN_OPTIONS.map((plan) => <option key={plan.key} value={plan.key}>{plan.label}</option>)}
            </select>
          </div>

          {message && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">{message}</p>}
          <button disabled={isPending} className="mt-5 w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-black uppercase text-white hover:bg-orange-600 disabled:opacity-50">
            {isPending ? "Criando..." : "Criar conta"}
          </button>
        </form>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <h2 className="text-xl font-black text-slate-950">Contas empresariais</h2>
              <p className="text-sm text-slate-500">Administre recursos, IA, WhatsApp, conhecimento e consumo por empresa.</p>
            </div>
            <Link href="/chaves-ia" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white"><KeyRound size={15} /> Chaves globais</Link>
          </div>

          {data.companies.map((company) => {
            const owner = company.memberships.find((membership) => membership.role === "OWNER")?.user;
            const pendingApproval = company.accountStatus !== ACCOUNT_STATUS.APPROVED || !company.planKey;
            return (
              <section key={company.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${pendingApproval ? "border-amber-200 ring-2 ring-amber-50" : "border-slate-200"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-950">{company.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{owner ? `${owner.name} · ${owner.email}` : "Sem dono vinculado"}</p>
                    <p className="mt-1 text-xs text-slate-400">WhatsApp: {company.whatsappNumber ?? "nao informado"} · {company.whatsappConnectionStatus}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-bold">
                    <span className={`rounded-full px-3 py-1 ${pendingApproval ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-blue-700"}`}>{pendingApproval ? "Aguardando liberacao" : "Liberada"}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Plano: {planLabel(company.planKey)}</span>
                    <span className={`rounded-full px-3 py-1 ${company.aiEnabled ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>IA {company.aiEnabled ? "ativa" : "pausada"}</span>
                    <span className="rounded-full bg-violet-50 px-3 py-1 text-violet-700">{company.assistant?.name ?? "Sem assistente"}</span>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 p-3">
                  <select defaultValue={company.planKey ?? "PROFESSIONAL"} onChange={(event) => updateCompanyAccess(company.id, { planKey: event.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500">
                    {PLAN_OPTIONS.map((plan) => <option key={plan.key} value={plan.key}>{plan.label}</option>)}
                  </select>
                  <button type="button" disabled={isPending} onClick={() => updateCompanyAccess(company.id, { accountStatus: ACCOUNT_STATUS.APPROVED, planKey: company.planKey ?? "PROFESSIONAL" })} className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-black uppercase text-white hover:bg-blue-800 disabled:opacity-50">
                    Aprovar/liberar
                  </button>
                  <button type="button" disabled={isPending} onClick={() => updateCompanyAccess(company.id, { accountStatus: ACCOUNT_STATUS.PENDING_APPROVAL, planKey: null })} className="rounded-xl border border-amber-200 bg-white px-4 py-2 text-xs font-black uppercase text-amber-700 hover:bg-amber-50 disabled:opacity-50">
                    Travar acesso
                  </button>
                  <button type="button" disabled={isPending} onClick={() => updateCompanyAccess(company.id, { accountStatus: ACCOUNT_STATUS.SUSPENDED })} className="rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-black uppercase text-red-700 hover:bg-red-50 disabled:opacity-50">
                    Suspender
                  </button>
                </div>
                <div className="mt-4 grid gap-2 text-sm md:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-3"><strong>{company._count?.conversations ?? 0}</strong><p className="text-slate-500">Conversas</p></div>
                  <div className="rounded-xl bg-slate-50 p-3"><strong>{company._count?.knowledgeItems ?? 0}</strong><p className="text-slate-500">Conhecimentos</p></div>
                  <div className="rounded-xl bg-slate-50 p-3"><strong>{company._count?.usageLogs ?? 0}</strong><p className="text-slate-500">Usos IA</p></div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/empresas/${company.id}`} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">Empresa</Link>
                  <Link href={`/empresas/${company.id}/ia`} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">Agente IA</Link>
                  <Link href="/conhecimento" className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">Conhecimento</Link>
                  <Link href="/consumo" className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">Consumo</Link>
                  <Link href="/whatsapp" className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><MessageCircle size={14} /> WhatsApp</Link>
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 shrink-0 text-emerald-700" size={22} />
          <p><strong>Isolamento:</strong> contas empresariais entram pelo mesmo login, mas recebem sessao vinculada somente as empresas cadastradas em seus memberships.</p>
        </div>
      </section>
    </div>
  );
}
