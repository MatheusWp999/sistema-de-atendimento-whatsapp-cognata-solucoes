import { AppShell } from "@/components/layout/AppShell";
import { WhatsAppShell } from "@/components/chat/WhatsAppShell";

export const dynamic = "force-dynamic";

export default function AtendimentoPage() {
  return (
    <AppShell>
      <WhatsAppShell />
    </AppShell>
  );
}
