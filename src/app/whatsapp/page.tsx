import { AppShell } from "@/components/layout/AppShell";
import { WhatsAppQrConnect } from "@/components/whatsapp/WhatsAppQrConnect";
import { getCurrentAuth } from "@/services/server-auth.service";

export const dynamic = "force-dynamic";

export default async function WhatsAppPage() {
  const auth = await getCurrentAuth();
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl p-4 md:p-5">
        <h1 className="text-3xl font-bold text-slate-900">WhatsApp real por QR Code</h1>
        <p className="mb-6 text-slate-500">
          Conecte um numero real via WhatsApp Web local para receber e responder conversas reais na central.
        </p>
        <WhatsAppQrConnect canCreateCompany={auth.type === "admin"} />
      </div>
    </AppShell>
  );
}
