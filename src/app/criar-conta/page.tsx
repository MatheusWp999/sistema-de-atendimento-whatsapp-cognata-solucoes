"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { CognitaLogo } from "@/components/brand/CognitaLogo";

export default function CreateAccountPage() {
  const [form, setForm] = useState({ companyName: "", ownerName: "", ownerEmail: "", ownerPassword: "", whatsappNumber: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setPending(false);
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Nao foi possivel criar a conta.");
      return;
    }
    setMessage("Conta criada. Agora aguarde a aprovacao e liberacao de plano pelo administrador.");
    setForm({ companyName: "", ownerName: "", ownerEmail: "", ownerPassword: "", whatsappNumber: "" });
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,_rgba(45,212,255,0.36),_transparent_30%),linear-gradient(135deg,#006bd6,#088df4_48%,#06b7ff)] px-4 py-10 text-slate-900">
      <form onSubmit={submit} className="w-full max-w-xl rounded-3xl bg-white/95 p-8 text-center shadow-2xl shadow-blue-950/30 backdrop-blur">
        <div className="flex justify-center">
          <CognitaLogo className="flex flex-col items-center gap-3 rounded-3xl bg-[linear-gradient(135deg,#006bd6,#06b7ff)] px-8 py-5 shadow-xl shadow-sky-100" markClassName="h-16 w-52" textClassName="text-cyan-50" subtitle="Solicitacao de acesso" />
        </div>
        <h1 className="mt-8 text-3xl font-black text-slate-950">Criar conta</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">Cadastre sua empresa. O administrador da Cognita vai aprovar a conta e liberar o plano antes do acesso ao painel.</p>

        <div className="mt-8 grid gap-4 text-left sm:grid-cols-2">
          <input value={form.companyName} onChange={(event) => update("companyName", event.target.value)} required placeholder="Nome da empresa" className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-sky-100 sm:col-span-2" />
          <input value={form.ownerName} onChange={(event) => update("ownerName", event.target.value)} required placeholder="Seu nome" className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-sky-100" />
          <input value={form.whatsappNumber} onChange={(event) => update("whatsappNumber", event.target.value)} placeholder="WhatsApp" className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-sky-100" />
          <input value={form.ownerEmail} onChange={(event) => update("ownerEmail", event.target.value)} required type="email" placeholder="Email de acesso" className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-sky-100" />
          <input value={form.ownerPassword} onChange={(event) => update("ownerPassword", event.target.value)} required type="password" minLength={8} placeholder="Senha" className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-sky-100" />
        </div>

        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        {message && <p className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-sky-50 p-3 text-sm font-semibold text-blue-700"><CheckCircle2 size={18} />{message}</p>}
        <button disabled={pending} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 font-bold text-white shadow-lg shadow-blue-200 hover:bg-blue-800 disabled:opacity-60">
          {pending ? "Enviando..." : "Solicitar acesso"} <ArrowRight size={18} />
        </button>
        <Link href="/login" className="mt-5 inline-flex text-sm font-bold text-blue-700 hover:text-blue-900">Ja tenho conta</Link>
      </form>
    </main>
  );
}
