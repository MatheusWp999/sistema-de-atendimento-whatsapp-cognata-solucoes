import { AppShell } from "@/components/layout/AppShell";
import { GrowthModulesPanel } from "@/components/growth/GrowthModulesPanel";

export const dynamic = "force-dynamic";

export default function GovernancaIAPage() {
  return (
    <AppShell>
      <GrowthModulesPanel moduleType="governance" />
    </AppShell>
  );
}
