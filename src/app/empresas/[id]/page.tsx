import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getCurrentAuth } from "@/services/server-auth.service";

export const dynamic = "force-dynamic";

export default async function EmpresaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getCurrentAuth();
  if (auth.type === "company_user" && !auth.session.companyIds.includes(id)) notFound();
  const company = await prisma.company.findUnique({ where: { id }, include: { assistant: true, conversations: true, knowledgeItems: true } });
  if (!company) notFound();
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl p-4 md:p-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{company.name}</h1>
              <p className="text-slate-500">{company.whatsappNumber ?? "Sem numero vinculado"}</p>
            </div>
            <StatusBadge label={company.aiEnabled ? "IA geral ativa" : "IA geral pausada"} tone={company.aiEnabled ? "green" : "red"} />
          </div>
          <p className="mt-4 text-slate-600">{company.description}</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4"><strong>{company.conversations.length}</strong><p className="text-sm text-slate-500">Conversas</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><strong>{company.knowledgeItems.length}</strong><p className="text-sm text-slate-500">Conhecimentos</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><strong>{company.assistant?.name ?? "-"}</strong><p className="text-sm text-slate-500">Atendente IA</p></div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/empresas/${company.id}/ia`} className="rounded-full bg-emerald-600 px-5 py-2 font-semibold text-white">Configurar IA</Link>
            <Link href={`/empresas/${company.id}/modulos`} className="rounded-full bg-slate-900 px-5 py-2 font-semibold text-white">Configurar modulos</Link>
            <Link href={`/atendimento`} className="rounded-full border border-slate-200 px-5 py-2 font-semibold text-slate-700">Abrir conversas</Link>
          </div>
        </div>

        {auth.type === "admin" && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
          <h2 className="font-bold text-red-800">Zona de risco</h2>
          <p className="mt-1 text-sm text-red-700">
            Apagar esta empresa removera definitivamente todas as conversas, mensagens, conhecimento, PDFs, treinamentos e logs vinculados.
          </p>
          <Link href={`/empresas/${company.id}/apagar`} className="mt-4 inline-flex rounded-full bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-700">
            Apagar empresa
          </Link>
        </div>}
      </div>
    </AppShell>
  );
}
