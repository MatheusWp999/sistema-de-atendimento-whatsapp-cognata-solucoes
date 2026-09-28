import { AppShell } from "@/components/layout/AppShell";
import { AssistantDashboard } from "@/components/dashboard/AssistantDashboard";
import { prisma } from "@/lib/db";
import { getDashboardStats } from "@/services/dashboard-stats.service";
import { getCompanyReleaseState, getCurrentAuth } from "@/services/server-auth.service";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const auth = await getCurrentAuth();
  const release = await getCompanyReleaseState(auth);
  if (auth.type === "company_user" && !release.released) redirect("/aguarde-liberacao");
  const allowedCompanyIds = auth.type === "company_user" ? auth.session.companyIds : undefined;
  const [companies, initialStats] = await Promise.all([
    prisma.company.findMany({
      where: allowedCompanyIds ? { id: { in: allowedCompanyIds } } : undefined,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        aiEnabled: true,
        whatsappConnectionStatus: true,
        assistant: {
          select: {
            id: true,
            name: true,
            role: true,
            personality: true,
            enabled: true,
          },
        },
      },
    }),
    getDashboardStats(auth.type === "company_user" ? auth.session.companyId : undefined),
  ]);

  return (
    <AppShell>
      <AssistantDashboard companies={companies} initialStats={initialStats} />
    </AppShell>
  );
}
