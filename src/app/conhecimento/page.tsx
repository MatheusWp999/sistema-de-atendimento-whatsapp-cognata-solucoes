import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { KnowledgeFilters } from "@/components/knowledge/KnowledgeFilters";
import { companyScopeFromAuth, getCurrentAuth } from "@/services/server-auth.service";

export const dynamic = "force-dynamic";

export default async function ConhecimentoPage({ searchParams }: { searchParams: Promise<{ companyId?: string }> }) {
  const { companyId } = await searchParams;
  const auth = await getCurrentAuth();
  const scopedCompanyId = companyScopeFromAuth(auth, companyId);
  const companyIds = auth.type === "company_user" ? auth.session.companyIds : undefined;
  const [items, companies] = await Promise.all([
    prisma.knowledgeItem.findMany({
      where: scopedCompanyId === "__unauthorized__"
        ? { id: "__unauthorized__" }
        : scopedCompanyId
          ? { companyId: scopedCompanyId }
          : companyIds ? { companyId: { in: companyIds } } : {},
      include: { company: true, _count: { select: { chunks: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.company.findMany({ where: companyIds ? { id: { in: companyIds } } : undefined, orderBy: { name: "asc" } }),
  ]);
  const selectedCompany = companies.find((company) => company.id === scopedCompanyId);
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl p-4 md:p-5">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Base de conhecimento</h1>
            <p className="text-slate-500">PDFs, FAQs, treinamentos e conteudos isolados por empresa.</p>
          </div>
          <Link href="/conhecimento/novo" className="rounded-full bg-emerald-600 px-5 py-2 font-semibold text-white">Novo conhecimento</Link>
        </div>
        <KnowledgeFilters companies={companies} />
        {selectedCompany && (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            Exibindo somente conhecimentos da empresa <strong>{selectedCompany.name}</strong>. A IA de outras empresas nao acessa estes conteudos.
          </div>
        )}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {items.length ? items.map((item) => (
            <Link key={item.id} href={`/conhecimento/${item.id}`} className="flex items-center justify-between border-b border-slate-100 px-5 py-4 hover:bg-slate-50">
              <div>
                <h2 className="font-bold text-slate-900">{item.title}</h2>
                <p className="text-sm text-slate-500">{item.company.name} • {item.type}</p>
              </div>
              <div className="flex gap-2">
                <StatusBadge label={item.active ? "ativo" : "inativo"} tone={item.active ? "green" : "red"} />
                <StatusBadge label={item.processed ? "processado" : "pendente"} tone={item.processed ? "blue" : "amber"} />
                <StatusBadge label={`${item._count.chunks} chunks`} />
              </div>
            </Link>
          )) : <p className="p-6 text-slate-500">Nenhum conhecimento cadastrado para este filtro.</p>}
        </div>
      </div>
    </AppShell>
  );
}
