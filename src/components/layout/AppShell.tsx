"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bot,
  BrainCircuit,
  Building2,
  ChevronDown,
  GraduationCap,
  KeyRound,
  Megaphone,
  MessageCircle,
  PlugZap,
  ShieldCheck,
  Settings,
  Smartphone,
  UserCircle2,
  WalletCards,
  Workflow,
} from "lucide-react";

const links = [
  { label: "Assistente", href: "/dashboard", icon: Bot, accent: "text-blue-600" },
  { label: "Atendimento", href: "/atendimento", icon: MessageCircle, accent: "text-slate-700" },
  { label: "Campanhas", href: "/campanhas", icon: Megaphone, accent: "text-slate-700" },
  { label: "Automacoes", href: "/automacoes", icon: Workflow, accent: "text-slate-700" },
  { label: "Integracoes", href: "/integracoes", icon: PlugZap, accent: "text-slate-700" },
  { label: "Governanca IA", href: "/governanca-ia", icon: ShieldCheck, accent: "text-slate-700" },
  { label: "WhatsApp QR", href: "/whatsapp", icon: Smartphone, accent: "text-orange-700" },
  { label: "Empresas", href: "/empresas", icon: Building2, accent: "text-slate-700" },
  { label: "Agentes IA", href: "/configuracoes-ia", icon: BrainCircuit, accent: "text-slate-700" },
  { label: "Conhecimento", href: "/conhecimento", icon: Settings, accent: "text-slate-700" },
  { label: "Treinamentos", href: "/treinamentos", icon: GraduationCap, accent: "text-slate-700" },
  { label: "Consumo", href: "/consumo", icon: BarChart3, accent: "text-slate-700" },
  { label: "Financeiro", href: "/consumo", icon: WalletCards, accent: "text-slate-700" },
];

const adminLinks = [
  { label: "Admin", href: "/admin", icon: ShieldCheck, accent: "text-blue-700" },
  { label: "Chaves IA", href: "/chaves-ia", icon: KeyRound, accent: "text-slate-700" },
  ...links,
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [accountOpen, setAccountOpen] = useState(false);
  const [account, setAccount] = useState<{ type: string; name?: string; email?: string | null; activeCompanyId?: string; companies?: Array<{ id: string; name: string; role: string; accountStatus?: string; planKey?: string | null }> } | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/me")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!active) return;
        setAccount(data);
        const activeCompany = data?.companies?.find((company: { id: string }) => company.id === data.activeCompanyId);
        if (data?.type === "company_user" && activeCompany && (activeCompany.accountStatus !== "APPROVED" || !activeCompany.planKey) && pathname !== "/aguarde-liberacao") {
          window.location.href = "/aguarde-liberacao";
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [pathname]);

  async function logout() {
    await Promise.all([
      fetch("/api/auth/company", { method: "DELETE" }).catch(() => undefined),
      fetch("/api/auth/admin", { method: "DELETE" }).catch(() => undefined),
    ]);
    window.location.href = "/login";
  }

  const visibleLinks = account?.type === "admin" ? adminLinks : links;

  return (
    <div className="min-h-screen bg-[#f5f6fa] text-slate-900">
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
      >
        Pular para o conteudo principal
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 flex w-[64px] flex-col items-center border-r border-slate-200 bg-white shadow-sm md:w-[76px]">
        <Link href="/dashboard" aria-label="Cognita" className="mt-5 grid h-9 w-9 place-items-center rounded-xl bg-blue-700 text-white shadow-sm shadow-sky-200">
          <MessageCircle size={19} fill="currentColor" />
        </Link>
        <nav aria-label="Navegacao principal" className="mt-8 flex flex-1 flex-col items-center gap-2 overflow-hidden pb-5">
          {visibleLinks.map(({ label, href, icon: Icon, accent }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={`${href}-${label}`}
                href={href}
                title={label}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`group grid h-9 w-9 place-items-center rounded-xl transition ${active ? "bg-sky-50 text-blue-700 ring-1 ring-sky-200" : "text-slate-700 hover:bg-slate-100 hover:text-blue-700"}`}
              >
                <Icon size={19} className={active ? "text-blue-700" : accent} />
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="min-h-screen pl-[64px] md:pl-[76px]">
        <header className="sticky top-0 z-20 flex h-[56px] items-center justify-between border-b border-slate-100 bg-white px-4 md:px-6">
          <h1 className="text-lg font-extrabold tracking-tight text-slate-800 md:text-xl">Cognita</h1>
          <div className="relative">
            <button onClick={() => setAccountOpen((open) => !open)} className="flex items-center gap-1.5 rounded-full border border-slate-100 bg-white p-1 pr-2.5 shadow-sm hover:bg-slate-50" aria-label="Perfil" aria-expanded={accountOpen}>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-50 text-blue-500">
                <UserCircle2 size={25} fill="currentColor" className="text-blue-500" />
              </span>
              <ChevronDown size={15} className="text-slate-500" />
            </button>
            {accountOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-xl">
                <p className="font-black text-slate-900">{account?.name ?? "Conta"}</p>
                <p className="mt-0.5 text-xs text-slate-500">{account?.email ?? (account?.type === "admin" ? "Acesso administrativo" : "Sessao local")}</p>
                {account?.companies?.length ? (
                  <div className="mt-3 rounded-xl bg-slate-50 p-2">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Empresas</p>
                    {account.companies.map((company) => (
                      <p key={company.id} className={`rounded-lg px-2 py-1 text-xs ${company.id === account.activeCompanyId ? "bg-sky-100 font-bold text-blue-700" : "text-slate-600"}`}>
                        {company.name} · {company.role}
                      </p>
                    ))}
                  </div>
                ) : null}
                <button onClick={logout} className="mt-3 w-full rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800">
                  Sair
                </button>
              </div>
            )}
          </div>
        </header>
        <main id="conteudo-principal" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
