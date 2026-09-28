"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { CognitaLogo } from "@/components/brand/CognitaLogo";

export default function PasswordRecoveryPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/auth/password-reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    setPending(false);
    const payload = await response.json().catch(() => ({})) as { error?: string; message?: string; devResetToken?: string };
    if (!response.ok) {
      setError(payload.error ?? "Nao foi possivel solicitar recuperacao.");
      return;
    }
    setMessage(payload.devResetToken ? `${payload.message} Token local: ${payload.devResetToken}` : payload.message ?? "Verifique seu email.");
  }

  async function confirmReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/auth/password-reset/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
    setPending(false);
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Nao foi possivel alterar a senha.");
      return;
    }
    setMessage("Senha atualizada. Voce ja pode entrar no painel.");
    setToken("");
    setPassword("");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,_rgba(45,212,255,0.36),_transparent_30%),linear-gradient(135deg,#006bd6,#088df4_48%,#06b7ff)] px-4 py-10 text-slate-900">
      <section className="w-full max-w-xl rounded-3xl bg-white/95 p-8 text-center shadow-2xl shadow-blue-950/30 backdrop-blur">
        <div className="flex justify-center">
          <CognitaLogo className="flex flex-col items-center gap-3 rounded-3xl bg-[linear-gradient(135deg,#006bd6,#06b7ff)] px-8 py-5 shadow-xl shadow-sky-100" markClassName="h-16 w-52" textClassName="text-cyan-50" subtitle="Recuperacao de senha" />
        </div>
        <h1 className="mt-8 text-3xl font-black text-slate-950">Recuperar senha</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">Solicite um link de recuperacao. Em ambiente local, o token aparece na tela para teste.</p>

        <form onSubmit={requestReset} className="mt-8 space-y-4 text-left">
          <label className="block text-sm font-bold text-slate-700" htmlFor="email">Email</label>
          <input id="email" value={email} onChange={(event) => setEmail(event.target.value)} required type="email" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-sky-100" />
          <button disabled={pending} className="w-full rounded-xl bg-blue-700 px-4 py-3 font-bold text-white hover:bg-blue-800 disabled:opacity-60">Solicitar recuperacao</button>
        </form>

        <form onSubmit={confirmReset} className="mt-6 space-y-4 rounded-2xl bg-sky-50 p-4 text-left">
          <p className="text-sm font-black text-blue-950">Ja tenho token</p>
          <input value={token} onChange={(event) => setToken(event.target.value)} placeholder="Token de recuperacao" className="w-full rounded-xl border border-sky-200 px-4 py-3 outline-none focus:border-blue-500" />
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={8} placeholder="Nova senha" className="w-full rounded-xl border border-sky-200 px-4 py-3 outline-none focus:border-blue-500" />
          <button disabled={pending || !token || !password} className="w-full rounded-xl bg-slate-950 px-4 py-3 font-bold text-white hover:bg-slate-800 disabled:opacity-60">Alterar senha</button>
        </form>

        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        {message && <p className="mt-4 rounded-xl bg-sky-50 p-3 text-sm font-semibold text-blue-700">{message}</p>}
        <Link href="/login" className="mt-5 inline-flex text-sm font-bold text-blue-700 hover:text-blue-900">Voltar para login</Link>
      </section>
    </main>
  );
}
