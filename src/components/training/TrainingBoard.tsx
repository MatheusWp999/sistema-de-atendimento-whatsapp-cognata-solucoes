"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Brain,
  CheckCircle2,
  Edit3,
  Grid2X2,
  MessageCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Sparkles,
  Star,
  Trash2,
  Undo2,
} from "lucide-react";
import type { CompanyDTO } from "@/components/chat/types";
import { KnowledgeForm } from "@/components/knowledge/KnowledgeForm";

type TrainingItem = {
  id: string;
  title: string;
  content?: string | null;
  active: boolean;
  processed: boolean;
  createdAt: string | Date;
  company: { id: string; name: string };
  _count: { chunks: number };
};

async function patchTraining(id: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/knowledge/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error((await response.json()).error ?? "Erro ao atualizar treinamento");
  return response.json();
}

async function deleteTraining(id: string) {
  const response = await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error((await response.json()).error ?? "Erro ao excluir treinamento");
}

function excerpt(value?: string | null) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "Sem instrucao textual cadastrada.";
  return text.length > 215 ? `${text.slice(0, 215)}...` : text;
}

function TrainingCard({ item, onToggle, onDelete }: { item: TrainingItem; onToggle: (item: TrainingItem) => void; onDelete: (item: TrainingItem) => void }) {
  return (
    <article className="flex min-h-[230px] flex-col rounded-lg border border-slate-300 bg-white p-3 shadow-sm transition hover:border-violet-400 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-bold text-slate-900">ID: {item.id.slice(-6).toUpperCase()}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggle(item)}
            className={`relative h-8 w-14 rounded-full p-1 transition ${item.active ? "bg-green-500" : "bg-slate-300"}`}
            aria-label={item.active ? "Desativar treinamento" : "Ativar treinamento"}
          >
            <span className={`block h-6 w-6 rounded-full bg-white shadow transition ${item.active ? "translate-x-6" : "translate-x-0"}`} />
          </button>
          <Link href={`/conhecimento/${item.id}`} className="text-violet-600 hover:text-violet-800" aria-label="Editar treinamento">
            <Edit3 size={19} />
          </Link>
          <button type="button" onClick={() => onDelete(item)} className="text-violet-600 hover:text-red-600" aria-label="Excluir treinamento">
            <Trash2 size={19} />
          </button>
        </div>
      </div>

      <div className="mt-10 space-y-4 text-sm leading-5 text-slate-900">
        <p><strong>Titulo:</strong> {item.title}</p>
        <p><strong>Instrucao:</strong> {excerpt(item.content)}</p>
      </div>

      <div className="mt-auto pt-4">
        <div className="mb-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
          <span>{item.company.name}</span>
          <span>•</span>
          <span>{item._count.chunks} chunks</span>
          <span>•</span>
          <span>{item.processed ? "processado" : "pendente"}</span>
        </div>
        <Link href={`/conhecimento/${item.id}`} className="flex w-full items-center justify-center rounded-md bg-violet-600 px-4 py-2 text-xs font-extrabold uppercase text-white hover:bg-violet-700">
          Ver detalhes
        </Link>
      </div>
    </article>
  );
}

export function TrainingBoard({ trainings, companies }: { trainings: TrainingItem[]; companies: CompanyDTO[] }) {
  const router = useRouter();
  const [items, setItems] = useState(trainings);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  async function toggleTraining(item: TrainingItem) {
    setError("");
    const previous = items;
    setItems((current) => current.map((training) => training.id === item.id ? { ...training, active: !training.active } : training));
    try {
      await patchTraining(item.id, { active: !item.active });
      router.refresh();
    } catch (toggleError) {
      setItems(previous);
      setError(toggleError instanceof Error ? toggleError.message : "Erro ao atualizar treinamento");
    }
  }

  async function removeTraining(item: TrainingItem) {
    if (!confirm(`Excluir o treinamento "${item.title}"?`)) return;
    setError("");
    const previous = items;
    setItems((current) => current.filter((training) => training.id !== item.id));
    try {
      await deleteTraining(item.id);
      router.refresh();
    } catch (deleteError) {
      setItems(previous);
      setError(deleteError instanceof Error ? deleteError.message : "Erro ao excluir treinamento");
    }
  }

  return (
    <div className="rounded-2xl bg-white px-4 py-5 shadow-sm md:px-6">
      <div className="flex items-center gap-2">
        <Sparkles size={19} className="text-slate-800" />
        <h2 className="text-lg font-extrabold text-slate-900">Treinamento</h2>
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm font-semibold uppercase text-violet-600 hover:text-violet-800">
          <Undo2 size={16} /> Voltar
        </Link>
        <button onClick={() => router.refresh()} className="inline-flex items-center gap-3 rounded-md bg-slate-100 px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-200">
          <RefreshCw size={18} /> Atualizar instrucoes <PlayCircle size={18} className="text-violet-600" />
        </button>
        <span className="inline-flex items-center gap-2 rounded-md bg-green-500 px-4 py-2 text-sm font-extrabold text-white">
          <MessageCircle size={18} /> Modo Treinador
        </span>
        <Link href="/conhecimento" className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
          <Star size={17} /> Regras Gerais <PlayCircle size={18} className="text-violet-600" />
        </Link>
        <Link href="/atendimento" className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-200">
          <MessageCircle size={17} /> Follow Up <PlayCircle size={18} className="text-violet-600" />
        </Link>
        <Link href="/configuracoes-ia" className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-200">
          <Grid2X2 size={17} /> Templates <PlayCircle size={18} className="text-violet-600" />
        </Link>
      </div>

      <p className="mt-5 text-sm text-slate-800">Navegue pelas modalidades de treinamento clicando nos botoes abaixo</p>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <span className="rounded-t-md bg-violet-600 px-3 py-2 text-xs font-extrabold uppercase text-white">Instrucoes</span>
        <span className="rounded-md bg-violet-500 px-3 py-2 text-xs font-bold uppercase text-white/95">Fluxos</span>
        <span className="inline-flex items-center gap-2 rounded-md bg-violet-500 px-3 py-2 text-xs font-bold uppercase text-white/95">Conteudos em midia <PlayCircle size={16} /></span>
        <span className="inline-flex items-center gap-2 rounded-md bg-violet-500 px-3 py-2 text-xs font-bold uppercase text-white/95"><Brain size={16} /> Neural Chains <PlayCircle size={16} /></span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white">
          Use essa secao para cadastrar treinamentos gerais para que eu tenha informacoes suficientes para manter uma conversa adequada com os clientes.
        </div>
        <button onClick={() => setShowForm((value) => !value)} className="grid h-9 w-16 place-items-center rounded-md bg-orange-500 text-white hover:bg-orange-600" aria-label="Adicionar treinamento">
          <Plus size={20} strokeWidth={3} />
        </button>
      </div>

      {showForm && (
        <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-4">
          {companies.length ? <KnowledgeForm companies={companies} defaultType="Treinamento" /> : <p className="text-sm text-amber-800">Cadastre uma empresa antes de adicionar treinamentos.</p>}
        </div>
      )}

      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {items.length ? items.map((item) => (
          <TrainingCard key={item.id} item={item} onToggle={toggleTraining} onDelete={removeTraining} />
        )) : (
          <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
            <CheckCircle2 className="mx-auto mb-3 text-violet-500" />
            Nenhum treinamento cadastrado ainda. Clique no botao laranja para adicionar o primeiro.
          </div>
        )}
      </div>
    </div>
  );
}
