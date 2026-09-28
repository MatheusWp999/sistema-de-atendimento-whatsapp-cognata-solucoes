import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { prisma } from "@/lib/db";
import { DeleteCompanyForm } from "@/components/companies/DeleteCompanyForm";
import { getCurrentAuth } from "@/services/server-auth.service";

export const dynamic = "force-dynamic";

export default async function ApagarEmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getCurrentAuth();
  if (auth.type !== "admin") notFound();
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          conversations: true,
          knowledgeItems: true,
          usageLogs: true,
        },
      },
    },
  });

  if (!company) notFound();

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl p-6">
        <h1 className="text-3xl font-bold text-red-700">Apagar empresa</h1>
        <p className="mb-6 text-slate-600">Dupla confirmacao obrigatoria antes da remocao definitiva.</p>

        <div className="mb-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <strong className="text-2xl text-slate-900">{company._count.conversations}</strong>
            <p className="text-sm text-slate-500">Conversas apagadas</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <strong className="text-2xl text-slate-900">{company._count.knowledgeItems}</strong>
            <p className="text-sm text-slate-500">Conhecimentos/PDFs apagados</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <strong className="text-2xl text-slate-900">{company._count.usageLogs}</strong>
            <p className="text-sm text-slate-500">Logs de consumo apagados</p>
          </div>
        </div>

        <DeleteCompanyForm companyId={company.id} companyName={company.name} />
      </div>
    </AppShell>
  );
}
