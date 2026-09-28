import { AppShell } from "@/components/layout/AppShell";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getCurrentAuth } from "@/services/server-auth.service";

export const dynamic = "force-dynamic";

export default async function ConsumoPage() {
  const auth = await getCurrentAuth();
  const companyIds = auth.type === "company_user" ? auth.session.companyIds : undefined;
  const where = companyIds ? { companyId: { in: companyIds } } : {};
  const [companies, byCompany, byModel, logs] = await Promise.all([
    prisma.company.findMany({ where: companyIds ? { id: { in: companyIds } } : undefined, orderBy: { name: "asc" } }),
    prisma.aIUsageLog.groupBy({ by: ["companyId"], where, _sum: { inputTokens: true, outputTokens: true, totalTokens: true, estimatedCost: true }, _count: { id: true } }),
    prisma.aIUsageLog.groupBy({ by: ["model"], where, _sum: { inputTokens: true, outputTokens: true, totalTokens: true, estimatedCost: true }, _count: { id: true } }),
    prisma.aIUsageLog.findMany({ where, include: { company: true }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const companyName = new Map(companies.map((company) => [company.id, company.name]));
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl p-4 md:p-5">
        <h1 className="text-3xl font-bold text-slate-900">Painel de consumo</h1>
        <p className="mb-6 text-slate-500">Consumo por empresa, modelo, chave e erros recentes.</p>
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">Por empresa</h2>
            <div className="space-y-3">
              {byCompany.map((row) => (
                <div key={row.companyId} className="rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between"><strong>{companyName.get(row.companyId)}</strong><StatusBadge label={`${row._count.id} requisicoes`} /></div>
                  <p className="mt-2 text-sm text-slate-500">Tokens: {row._sum.totalTokens ?? 0} • Custo: {formatCurrency(row._sum.estimatedCost ?? 0)}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">Por modelo</h2>
            <div className="space-y-3">
              {byModel.map((row) => (
                <div key={row.model} className="rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between"><strong>{row.model}</strong><StatusBadge label={`${row._count.id} usos`} /></div>
                  <p className="mt-2 text-sm text-slate-500">Entrada: {row._sum.inputTokens ?? 0} • Saida: {row._sum.outputTokens ?? 0} • {formatCurrency(row._sum.estimatedCost ?? 0)}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">Erros e usos recentes</h2>
          <div className="divide-y divide-slate-100">
            {logs.map((log) => (
              <div key={log.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div><strong>{log.company.name}</strong><p className="text-slate-500">{log.requestType} • {log.model} • {log.usedCompanyKey ? "chave individual" : "chave geral"}</p></div>
                <div className="flex items-center gap-2"><StatusBadge label={log.status} tone={log.status === "success" ? "green" : "red"} /><span>{formatCurrency(log.estimatedCost ?? 0)}</span></div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
