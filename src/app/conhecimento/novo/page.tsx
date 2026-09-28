import { AppShell } from "@/components/layout/AppShell";
import { prisma } from "@/lib/db";
import { KnowledgeForm } from "@/components/knowledge/KnowledgeForm";
import { getCurrentAuth } from "@/services/server-auth.service";

export const dynamic = "force-dynamic";

export default async function NovoConhecimentoPage() {
  const auth = await getCurrentAuth();
  const companyIds = auth.type === "company_user" ? auth.session.companyIds : undefined;
  const companies = await prisma.company.findMany({ where: companyIds ? { id: { in: companyIds } } : undefined, orderBy: { name: "asc" } });
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl p-6">
        <h1 className="text-3xl font-bold text-slate-900">Novo conhecimento</h1>
        <p className="mb-6 text-slate-500">Selecione explicitamente a empresa e envie texto ou PDF sobre persona, atividades, produtos, servicos, regras ou treinamentos.</p>
        {companies.length ? <KnowledgeForm companies={companies} /> : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
            Cadastre uma empresa real antes de adicionar conhecimento.
          </div>
        )}
      </div>
    </AppShell>
  );
}
