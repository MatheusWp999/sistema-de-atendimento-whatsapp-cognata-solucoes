"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteCompanyForm({ companyId, companyName }: { companyId: string; companyName: string }) {
  const router = useRouter();
  const [confirmationName, setConfirmationName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const canDelete = confirmationName === companyName;

  async function deleteCompany() {
    if (!canDelete) return;
    setIsDeleting(true);
    setError("");

    try {
      const response = await fetch(`/api/companies/${companyId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationName }),
      });

      if (!response.ok) {
        throw new Error((await response.json()).error ?? "Erro ao apagar empresa");
      }

      router.push("/empresas");
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Erro ao apagar empresa");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
      <div className="rounded-2xl bg-red-50 p-5 text-red-950">
        <h2 className="text-xl font-bold">Confirmacao definitiva</h2>
        <p className="mt-2 text-sm leading-relaxed">
          Esta acao apagara a empresa <strong>{companyName}</strong> e todas as informacoes vinculadas a ela no banco: IA, conversas,
          mensagens, conhecimentos, PDFs, chunks, treinamentos e logs de consumo.
        </p>
        <p className="mt-2 text-sm font-bold">Esta acao nao pode ser desfeita.</p>
      </div>

      <label className="mt-6 block">
        <span className="mb-2 block text-sm font-bold text-slate-700">
          Digite exatamente o nome da empresa para apagar definitivamente:
        </span>
        <input
          value={confirmationName}
          onChange={(event) => setConfirmationName(event.target.value)}
          placeholder={companyName}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-red-500"
        />
      </label>

      <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
        Nome exigido: <strong>{companyName}</strong>
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={() => router.push(`/empresas/${companyId}`)}
          className="rounded-full border border-slate-300 px-5 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          onClick={deleteCompany}
          disabled={!canDelete || isDeleting}
          className="rounded-full bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isDeleting ? "Apagando..." : "Apagar definitivamente"}
        </button>
      </div>
    </div>
  );
}
