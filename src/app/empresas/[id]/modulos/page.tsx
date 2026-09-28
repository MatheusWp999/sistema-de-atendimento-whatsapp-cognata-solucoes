import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { CompanyModulesPanel } from "@/components/business-modules/CompanyModulesPanel";
import { prisma } from "@/lib/db";
import { listCompanyModules } from "@/modules/business-modules/module-registry.service";
import { getCurrentAuth } from "@/services/server-auth.service";

export const dynamic = "force-dynamic";

export default async function EmpresaModulosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getCurrentAuth();
  if (auth.type === "company_user" && !auth.session.companyIds.includes(id)) notFound();
  const company = await prisma.company.findUnique({ where: { id }, select: { id: true, name: true, description: true } });
  if (!company) notFound();
  const modules = await listCompanyModules(company.id);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl p-4 md:p-5">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Modulos da empresa</h1>
            <p className="text-slate-500">Ative ferramentas especificas para {company.name}.</p>
          </div>
          <Link href={`/empresas/${company.id}`} className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-300">
            Voltar para empresa
          </Link>
        </div>

        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          <strong>Como funciona:</strong> modulos ativos entram no atendimento antes da IA livre. No modulo de pedidos, o sistema coleta itens, entrega/retirada, endereco, pagamento e confirmacao antes de criar o pedido.
        </div>

        <CompanyModulesPanel companyId={company.id} initialModules={modules} />
      </div>
    </AppShell>
  );
}
