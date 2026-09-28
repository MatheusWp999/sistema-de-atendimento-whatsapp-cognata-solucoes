import { AppShell } from "@/components/layout/AppShell";
import { prisma } from "@/lib/db";
import { sanitizeCompanies } from "@/lib/api";
import { TrainingBoard } from "@/components/training/TrainingBoard";
import { getCurrentAuth } from "@/services/server-auth.service";

export const dynamic = "force-dynamic";

export default async function TreinamentosPage() {
  const auth = await getCurrentAuth();
  const companyIds = auth.type === "company_user" ? auth.session.companyIds : undefined;
  const [trainings, companies] = await Promise.all([
    prisma.knowledgeItem.findMany({
      where: { type: "Treinamento", ...(companyIds ? { companyId: { in: companyIds } } : {}) },
      include: { company: true, _count: { select: { chunks: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.company.findMany({ where: companyIds ? { id: { in: companyIds } } : undefined, orderBy: { name: "asc" } }),
  ]);
  return (
    <AppShell>
      <div className="mx-auto max-w-[1500px] p-4 md:p-5">
        <TrainingBoard trainings={trainings.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }))} companies={sanitizeCompanies(companies)} />
      </div>
    </AppShell>
  );
}
