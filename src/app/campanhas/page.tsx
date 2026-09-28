import { AppShell } from "@/components/layout/AppShell";
import { GrowthModulesPanel } from "@/components/growth/GrowthModulesPanel";

export const dynamic = "force-dynamic";

export default function CampanhasPage() {
  return (
    <AppShell>
      <GrowthModulesPanel moduleType="campaigns" />
    </AppShell>
  );
}
