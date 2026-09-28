import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock3, ShieldCheck } from "lucide-react";
import { CognitaLogo } from "@/components/brand/CognitaLogo";
import { SwitchAccountButton } from "@/components/auth/SwitchAccountButton";
import { getCompanyReleaseState, getCurrentAuth } from "@/services/server-auth.service";

export const dynamic = "force-dynamic";

export default async function AwaitApprovalPage() {
  const auth = await getCurrentAuth();
  if (auth.type === "anonymous") redirect("/login");
  if (auth.type === "admin") redirect("/admin");

  const release = await getCompanyReleaseState(auth);
  if (release.released) redirect("/dashboard");

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,_rgba(45,212,255,0.36),_transparent_30%),linear-gradient(135deg,#006bd6,#088df4_48%,#06b7ff)] px-4 text-slate-900">
      <section className="w-full max-w-2xl rounded-[2rem] bg-white/95 p-8 text-center shadow-2xl shadow-blue-950/30 backdrop-blur">
        <div className="flex justify-center">
          <CognitaLogo className="flex flex-col items-center gap-3 rounded-3xl bg-[linear-gradient(135deg,#006bd6,#06b7ff)] px-8 py-5 shadow-xl shadow-sky-100" markClassName="h-16 w-52" textClassName="text-cyan-50" subtitle="Atendimento IA no WhatsApp" />
        </div>
        <div className="mx-auto mt-8 grid h-20 w-20 place-items-center rounded-full bg-sky-50 text-blue-700 ring-1 ring-sky-100">
          <Clock3 size={36} />
        </div>
        <h1 className="mt-6 text-3xl font-black text-slate-950">Aguarde a liberacao do administrador</h1>
        <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-slate-600">
          Sua conta foi criada com sucesso, mas ainda nao possui um plano liberado. Assim que o administrador aprovar a empresa e adicionar um plano, o painel sera desbloqueado automaticamente.
        </p>
        <div className="mt-6 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-left text-sm text-blue-950">
          <div className="mb-2 flex items-center gap-2 font-black"><ShieldCheck size={18} /> Status da solicitacao</div>
          {release.companies.map((company) => (
            <p key={company.id} className="py-1">
              <strong>{company.name}</strong>: {company.accountStatus === "PENDING_APPROVAL" ? "pendente de aprovacao" : "sem plano liberado"}
            </p>
          ))}
        </div>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/" className="rounded-full border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Voltar para o site</Link>
          <SwitchAccountButton />
        </div>
      </section>
    </main>
  );
}
