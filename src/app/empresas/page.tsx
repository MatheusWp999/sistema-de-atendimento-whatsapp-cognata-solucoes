import { AppShell } from "@/components/layout/AppShell";
import { prisma } from "@/lib/db";
import { sanitizeCompanies } from "@/lib/api";
import { CompaniesList } from "@/components/companies/CompaniesList";
import { getCurrentAuth } from "@/services/server-auth.service";

export const dynamic = "force-dynamic";

export default async function EmpresasPage() {
  const auth = await getCurrentAuth();
  const companyIds = auth.type === "company_user" ? auth.session.companyIds : undefined;
  const companies = await prisma.company.findMany({
    where: companyIds ? { id: { in: companyIds } } : undefined,
    include: { assistant: true, _count: { select: { conversations: true, knowledgeItems: true } } },
    orderBy: { name: "asc" },
  });
  const trainingCounts = await prisma.knowledgeItem.groupBy({
    by: ["companyId"],
    where: { type: "Treinamento", ...(companyIds ? { companyId: { in: companyIds } } : {}) },
    _count: { id: true },
  });
  const trainingsByCompany = new Map(trainingCounts.map((item) => [item.companyId, item._count.id]));

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl p-4 md:p-5">
        <h1 className="text-2xl font-bold text-slate-900">Empresas</h1>
        <p className="mb-6 text-slate-500">Cadastro e gerenciamento basico das empresas.</p>
        <CompaniesList initialCompanies={sanitizeCompanies(companies).map((company) => ({ ...company, trainingCount: trainingsByCompany.get(company.id) ?? 0 }))} />
      </div>
    </AppShell>
  );
}
