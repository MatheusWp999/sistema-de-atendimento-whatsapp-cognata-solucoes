import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getCurrentAuth } from "@/services/server-auth.service";

export const dynamic = "force-dynamic";

const permanentTypes = new Set([
  "Identidade e persona da IA",
  "Regras de atendimento",
  "Politica interna",
  "Informacao juridica",
  "Treinamento",
  "Script comercial",
  "Objecoes e respostas",
  "Informacoes da empresa",
  "Atividades da empresa",
]);

export default async function ConhecimentoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await prisma.knowledgeItem.findUnique({ where: { id }, include: { company: true, chunks: true } });
  if (!item) notFound();
  const auth = await getCurrentAuth();
  if (auth.type === "company_user" && !auth.session.companyIds.includes(item.companyId)) notFound();
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl p-4 md:p-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{item.title}</h1>
              <p className="text-slate-500">{item.company.name} • {item.type}</p>
            </div>
            <div className="flex gap-2">
              <StatusBadge label={item.active ? "ativo" : "inativo"} tone={item.active ? "green" : "red"} />
              <StatusBadge label={`${item.chunks.length} chunks`} />
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            Este conhecimento pertence exclusivamente a <strong>{item.company.name}</strong>. Somente conversas desta empresa podem consultar estes chunks no RAG.
          </div>
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            Uso pelo agente: <strong>{permanentTypes.has(item.type) ? "entra sempre como orientacao permanente no prompt da empresa" : "entra como base factual recuperada quando a pergunta for relacionada"}</strong>.
          </div>
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3"><strong>Origem</strong><p className="text-slate-500">{item.sourceType}</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><strong>Tipo</strong><p className="text-slate-500">{item.type}</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><strong>Arquivo</strong><p className="break-all text-slate-500">{item.filePath ?? "Sem arquivo"}</p></div>
          </div>
          <pre className="mt-6 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-sm text-slate-100">{item.content}</pre>
        </section>
      </div>
    </AppShell>
  );
}
