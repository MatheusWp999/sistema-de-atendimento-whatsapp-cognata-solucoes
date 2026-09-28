"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { CompanyDTO } from "@/components/chat/types";

export function KnowledgeFilters({ companies }: { companies: CompanyDTO[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = searchParams.get("companyId") ?? "";

  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <label className="block">
        <span className="mb-2 block text-sm font-bold text-slate-700">Filtrar por empresa</span>
        <select
          value={companyId}
          onChange={(event) => {
            const value = event.target.value;
            router.push(value ? `/conhecimento?companyId=${value}` : "/conhecimento");
          }}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-emerald-500 md:max-w-md"
        >
          <option value="">Todas as empresas</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
