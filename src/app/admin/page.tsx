import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { AdminCompanyAccountsPanel } from "@/components/admin/AdminCompanyAccountsPanel";
import { prisma } from "@/lib/db";
import { sanitizeCompanies } from "@/lib/api";
import { getCurrentAuth } from "@/services/server-auth.service";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const auth = await getCurrentAuth();
  if (auth.type !== "admin") redirect(auth.type === "company_user" ? "/dashboard" : "/login");

  const [companies, users, usage] = await Promise.all([
    prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        assistant: true,
        memberships: { include: { user: { select: { id: true, name: true, email: true, role: true, active: true, lastLoginAt: true } } } },
        _count: { select: { conversations: true, knowledgeItems: true, usageLogs: true } },
      },
    }),
    prisma.user.count({ where: { active: true } }),
    prisma.aIUsageLog.aggregate({ _sum: { estimatedCost: true }, _count: { id: true } }),
  ]);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1500px] p-4 md:p-5">
        <div className="mb-6 rounded-3xl bg-slate-950 p-6 text-white shadow-xl shadow-slate-200">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-violet-300">Administrativo da plataforma</p>
          <h1 className="mt-3 text-3xl font-black">Controle de contas empresariais</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Crie empresas contratantes, gere o primeiro usuario de acesso e acompanhe recursos de IA, WhatsApp, conhecimento, conversas e consumo.
          </p>
        </div>

        <AdminCompanyAccountsPanel initialData={{
          stats: {
            companies: companies.length,
            activeUsers: users,
            aiRequests: usage._count.id,
            estimatedCost: usage._sum.estimatedCost ?? 0,
          },
          companies: sanitizeCompanies(companies).map((company) => ({
            ...company,
            memberships: company.memberships.map((membership) => ({
              ...membership,
              user: {
                ...membership.user,
                lastLoginAt: membership.user.lastLoginAt?.toISOString() ?? null,
              },
            })),
          })),
        }} />
      </div>
    </AppShell>
  );
}
