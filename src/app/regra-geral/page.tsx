import { AppShell } from "@/components/layout/AppShell";
import { GeneralCompanyForm } from "@/components/companies/GeneralCompanyForm";
import { prisma } from "@/lib/db";
import { getCurrentAuth } from "@/services/server-auth.service";

export const dynamic = "force-dynamic";

type GeneralBusinessHours = {
  businessType?: string;
  descriptionTitle?: string;
  alwaysOpen?: boolean;
  continueAfterHours?: boolean;
};

function parseBusinessHours(value: unknown): GeneralBusinessHours {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as GeneralBusinessHours;
}

export default async function RegraGeralPage() {
  const auth = await getCurrentAuth();
  const company = await prisma.company.findFirst({
    where: auth.type === "company_user" ? { id: auth.session.companyId } : undefined,
    orderBy: { name: "asc" },
  });
  if (!company) {
    return (
      <AppShell>
        <main className="min-h-[calc(100vh-56px)] bg-white px-10 py-8">
          <h2 className="text-xl font-semibold text-slate-950">Informações gerais da sua empresa</h2>
          <p className="mt-3 text-sm text-slate-600">Cadastre uma empresa antes de configurar as regras gerais.</p>
        </main>
      </AppShell>
    );
  }

  const businessHours = parseBusinessHours(company.businessHours);
  const generalInfo = await prisma.knowledgeItem.findFirst({
    where: { companyId: company.id, type: "Informacoes da empresa", sourceType: "general-info-form" },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <AppShell>
      <main className="min-h-[calc(100vh-56px)] bg-white px-10 py-8 md:px-16 lg:px-20">
        <GeneralCompanyForm
          companyId={company.id}
          initialValues={{
            name: company.name,
            businessType: businessHours.businessType ?? company.notes ?? "",
            descriptionTitle: businessHours.descriptionTitle ?? generalInfo?.title ?? "Descrição da nossa empresa e de como trabalhamos",
            description: company.description ?? generalInfo?.content ?? "",
            alwaysOpen: businessHours.alwaysOpen ?? false,
            continueAfterHours: businessHours.continueAfterHours ?? true,
          }}
        />
      </main>
    </AppShell>
  );
}
