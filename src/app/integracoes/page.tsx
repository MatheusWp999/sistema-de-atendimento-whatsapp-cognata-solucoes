import { AppShell } from "@/components/layout/AppShell";
import { GrowthModulesPanel } from "@/components/growth/GrowthModulesPanel";

export const dynamic = "force-dynamic";

export default function IntegracoesPage() {
  return (
    <AppShell>
      <GrowthModulesPanel moduleType="integrations" />
    </AppShell>
  );
}
