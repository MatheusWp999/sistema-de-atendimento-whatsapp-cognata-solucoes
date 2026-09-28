"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { CognitaLogo } from "@/components/brand/CognitaLogo";

function safeNextPath(value: string | null) {
  if (!value || value === "/" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/dashboard";
  return value;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [nextPath] = useState(() => (typeof window === "undefined" ? "/dashboard" : safeNextPath(new URLSearchParams(window.location.search).get("next"))));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const response = await fetch("/api/auth/company", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setPending(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? "Nao foi possivel entrar.");
      return;
    }
    const payload = await response.json().catch(() => ({})) as { redirectTo?: string; type?: string };
    const redirectTo = payload.redirectTo ?? nextPath;
    window.location.href = payload.type === "admin" || redirectTo === "/aguarde-liberacao" ? redirectTo : nextPath;
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,_rgba(45,212,255,0.36),_transparent_30%),linear-gradient(135deg,#006bd6,#088df4_48%,#06b7ff)] px-4 py-10 text-slate-900">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white/95 p-8 text-center shadow-2xl shadow-blue-950/30 backdrop-blur">
        <div className="flex justify-center">
          <CognitaLogo className="flex flex-col items-center gap-3 rounded-3xl bg-[linear-gradient(135deg,#006bd6,#06b7ff)] px-8 py-5 shadow-xl shadow-sky-100" markClassName="h-16 w-52" textClassName="text-cyan-50" subtitle="Atendimento IA no WhatsApp" />
        </div>
        <h1 className="mt-8 text-3xl font-black text-slate-950">Entrar no painel</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-600">
          Acesse sua operacao, gerencie empresas e acompanhe atendimentos inteligentes em um so lugar.
        </p>

        <div className="mt-8 space-y-4 text-left">
          <label className="block text-sm font-bold text-slate-700" htmlFor="company-email">Email</label>
          <input
            id="company-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-sky-100"
            autoComplete="email"
            required
          />
          <label className="block text-sm font-bold text-slate-700" htmlFor="company-password">Senha</label>
          <input
            id="company-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-sky-100"
            autoComplete="current-password"
            required
          />
        </div>

        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={pending} className="mt-6 w-full rounded-xl bg-blue-700 px-4 py-3 font-bold text-white shadow-lg shadow-blue-200 hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
          {pending ? "Entrando..." : "Entrar"}
        </button>
        <div className="mt-5 flex flex-col items-center justify-center gap-2 text-sm font-semibold sm:flex-row sm:gap-4">
          <Link href="/recuperar-senha" className="text-blue-700 hover:text-blue-900">Esqueci minha senha</Link>
          <span className="hidden text-slate-300 sm:block">|</span>
          <Link href="/criar-conta" className="text-blue-700 hover:text-blue-900">Criar nova conta</Link>
        </div>
        <Link href="/" className="mt-6 inline-flex text-xs font-bold uppercase tracking-wide text-slate-400 hover:text-blue-700">Voltar para o site</Link>
      </form>
    </main>
  );
}
