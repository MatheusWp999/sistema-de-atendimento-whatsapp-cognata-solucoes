"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";

type ModuleField = {
  key: string;
  label: string;
  type: "boolean" | "text" | "number" | "select";
  description?: string;
  defaultValue?: string | number | boolean;
  options?: string[];
};

type CompanyModuleDTO = {
  key: string;
  name: string;
  category: string;
  description: string;
  enabled: boolean;
  configurable: boolean;
  configSchema: ModuleField[];
  config: Record<string, string | number | boolean | null>;
};

async function saveModule(companyId: string, moduleItem: CompanyModuleDTO) {
  const response = await fetch(`/api/companies/${companyId}/modules`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ moduleKey: moduleItem.key, enabled: moduleItem.enabled, config: moduleItem.config }),
  });
  if (!response.ok) throw new Error((await response.json()).error ?? "Erro ao salvar modulo");
  return response.json() as Promise<CompanyModuleDTO[]>;
}

export function CompanyModulesPanel({ companyId, initialModules }: { companyId: string; initialModules: CompanyModuleDTO[] }) {
  const [modules, setModules] = useState(initialModules);
  const [savingKey, setSavingKey] = useState<string>();
  const [error, setError] = useState<string>();

  async function updateModule(moduleItem: CompanyModuleDTO) {
    setSavingKey(moduleItem.key);
    setError(undefined);
    try {
      setModules(await saveModule(companyId, moduleItem));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro ao salvar modulo");
    } finally {
      setSavingKey(undefined);
    }
  }

  function changeConfig(moduleItem: CompanyModuleDTO, field: ModuleField, value: string | boolean) {
    const normalizedValue = field.type === "number" ? Number(value || 0) : value;
    setModules((current) => current.map((item) => item.key === moduleItem.key ? { ...item, config: { ...item.config, [field.key]: normalizedValue } } : item));
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {modules.map((moduleItem) => (
        <section key={moduleItem.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">{moduleItem.name}</h2>
                <StatusBadge label={moduleItem.category} tone="blue" />
                <StatusBadge label={moduleItem.enabled ? "Ativo" : "Inativo"} tone={moduleItem.enabled ? "green" : "slate"} />
              </div>
              <p className="mt-2 text-sm text-slate-600">{moduleItem.description}</p>
            </div>
            <button
              onClick={() => updateModule({ ...moduleItem, enabled: !moduleItem.enabled })}
              disabled={savingKey === moduleItem.key}
              className={`rounded-full px-5 py-2 text-sm font-bold text-white disabled:opacity-60 ${moduleItem.enabled ? "bg-slate-700 hover:bg-slate-800" : "bg-emerald-600 hover:bg-emerald-700"}`}
            >
              {savingKey === moduleItem.key ? "Salvando..." : moduleItem.enabled ? "Desativar" : "Ativar"}
            </button>
          </div>

          {moduleItem.configurable && moduleItem.configSchema.length > 0 && (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {moduleItem.configSchema.map((field) => (
                <label key={field.key} className="rounded-xl bg-slate-50 p-4 text-sm">
                  <span className="font-semibold text-slate-800">{field.label}</span>
                  {field.description && <span className="mt-1 block text-xs text-slate-500">{field.description}</span>}
                  {field.type === "boolean" ? (
                    <select
                      value={moduleItem.config[field.key] ? "true" : "false"}
                      onChange={(event) => changeConfig(moduleItem, field, event.target.value === "true")}
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:border-emerald-500"
                    >
                      <option value="true">Sim</option>
                      <option value="false">Nao</option>
                    </select>
                  ) : (
                    <input
                      type={field.type === "number" ? "number" : "text"}
                      value={String(moduleItem.config[field.key] ?? "")}
                      onChange={(event) => changeConfig(moduleItem, field, event.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:border-emerald-500"
                    />
                  )}
                </label>
              ))}
              <div className="md:col-span-2">
                <button
                  onClick={() => updateModule(moduleItem)}
                  disabled={savingKey === moduleItem.key}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                >
                  {savingKey === moduleItem.key ? "Salvando..." : "Salvar configuracoes"}
                </button>
              </div>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
