"use client";

import Link from "next/link";
import { useState } from "react";

type GeneralCompanyFormProps = {
  companyId: string;
  initialValues: {
    name: string;
    businessType: string;
    descriptionTitle: string;
    description: string;
    alwaysOpen: boolean;
    continueAfterHours: boolean;
  };
};

async function saveGeneralInfo(companyId: string, body: GeneralCompanyFormProps["initialValues"]) {
  const response = await fetch(`/api/companies/${companyId}/general-info`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error((await response.json()).error ?? "Erro ao salvar informacoes gerais");
  return response.json();
}

export function GeneralCompanyForm({ companyId, initialValues }: GeneralCompanyFormProps) {
  const [values, setValues] = useState(initialValues);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function update<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    setError("");
    try {
      await saveGeneralInfo(companyId, values);
      setNotice("Informacoes gerais salvas e enviadas para a base do agente.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro ao salvar informacoes gerais");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-[520px] space-y-5 text-slate-950">
      <div>
        <h2 className="text-xl font-medium text-slate-950">Informações gerais da sua empresa</h2>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-extrabold text-slate-950" htmlFor="company-name">Nome da sua empresa*</label>
        <input
          id="company-name"
          value={values.name}
          onChange={(event) => update("name", event.target.value)}
          required
          className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-extrabold text-slate-950" htmlFor="business-type">O que sua empresa é?*</label>
        <input
          id="business-type"
          value={values.businessType}
          onChange={(event) => update("businessType", event.target.value)}
          required
          placeholder="Hotelaria, restaurante, clinica, loja..."
          className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
        />
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-extrabold text-slate-950">Descrição da sua empresa</h3>
        <div className="space-y-2">
          <label className="block text-sm text-slate-950" htmlFor="description-title">Título:</label>
          <input
            id="description-title"
            value={values.descriptionTitle}
            onChange={(event) => update("descriptionTitle", event.target.value)}
            className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm text-slate-950" htmlFor="description">Descrição:</label>
          <textarea
            id="description"
            value={values.description}
            onChange={(event) => update("description", event.target.value)}
            className="h-[250px] w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-3 text-sm leading-4 outline-none focus:border-blue-400"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-950">
        <input
          type="checkbox"
          checked={values.alwaysOpen}
          onChange={(event) => update("alwaysOpen", event.target.checked)}
          className="h-4 w-4 accent-blue-600"
        />
        Minha empresa não fecha, funcionamos 24h
      </label>

      <div className="space-y-3 pt-5">
        <p className="text-sm font-extrabold text-slate-950">Fora do horário de atendimento devo continuar atendendo?</p>
        <div className="flex flex-wrap gap-5 text-sm text-slate-950">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={values.continueAfterHours}
              onChange={(event) => update("continueAfterHours", event.target.checked)}
              className="h-4 w-4 accent-blue-600"
            />
            Sim, seguir atendendo normalmente
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!values.continueAfterHours}
              onChange={(event) => update("continueAfterHours", !event.target.checked)}
              className="h-4 w-4 accent-blue-600"
            />
            Não, informar apenas que estamos fechados
          </label>
        </div>
      </div>

      {notice && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{notice}</p>}
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex gap-9 pt-2">
        <Link href="/dashboard" className="grid h-14 w-32 place-items-center rounded-md border border-slate-950 bg-white text-sm font-medium text-slate-950 hover:bg-slate-50">
          CANCELAR
        </Link>
        <button type="submit" disabled={saving} className="h-14 w-56 rounded-md bg-orange-500 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60">
          {saving ? "SALVANDO..." : "SALVAR"}
        </button>
      </div>
    </form>
  );
}
