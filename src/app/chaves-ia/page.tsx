import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { KeyManagementPanel } from "@/components/ai-config/KeyManagementPanel";
import { getCurrentAuth } from "@/services/server-auth.service";

export const dynamic = "force-dynamic";

export default async function ChavesIAPage() {
  const auth = await getCurrentAuth();
  if (auth.type !== "admin") redirect(auth.type === "company_user" ? "/dashboard" : "/login");
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl p-4 md:p-5">
        <h1 className="text-3xl font-bold text-slate-900">Chaves e motores de IA</h1>
        <p className="mb-6 text-slate-500">
          Gerencie chave geral, chave individual, provedor ativo e modelos por empresa sem expor os valores completos no frontend.
        </p>
        <KeyManagementPanel />
      </div>
    </AppShell>
  );
}
