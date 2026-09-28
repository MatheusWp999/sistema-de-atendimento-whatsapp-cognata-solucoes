"use client";

import { StatusBadge } from "@/components/ui/StatusBadge";
import type { CompanyUserDTO, ConversationDetailsDTO } from "./types";

export function ConversationDetails({
  conversation,
  users = [],
  onUpdate,
  isSaving,
  onForceTest,
}: {
  conversation?: ConversationDetailsDTO;
  users?: CompanyUserDTO[];
  onUpdate?: (payload: Partial<Pick<ConversationDetailsDTO, "supportStatus" | "priority" | "assignedUserId" | "tags" | "internalNotes" | "aiSummary">>) => void;
  isSaving?: boolean;
  onForceTest?: () => void;
}) {
  if (!conversation) return <aside className="hidden w-[320px] border-l border-slate-200 bg-white p-5 text-sm text-slate-500 xl:block">Sem conversa selecionada.</aside>;

  const consultedDocs = conversation.messages
    .flatMap((message) => (Array.isArray(message.metadata?.retrievedKnowledge) ? message.metadata?.retrievedKnowledge : []))
    .filter(Boolean)
    .slice(-5);

  return (
    <aside className="hidden w-[320px] min-h-0 overflow-y-auto border-l border-slate-200 bg-white p-5 xl:block">
      <div className="text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-700 text-2xl font-bold text-white">
          {(conversation.customerName ?? conversation.customerPhone).slice(0, 1).toUpperCase()}
        </div>
        <h3 className="mt-3 font-bold text-slate-900">{conversation.customerName ?? "Cliente"}</h3>
        <p className="text-sm text-slate-500">{conversation.customerPhone}</p>
      </div>
      <div className="mt-6 space-y-4 text-sm">
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase text-slate-400">Status</h4>
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={conversation.aiStatus} tone="blue" />
            <StatusBadge label={conversation.currentOwner} tone={conversation.currentOwner === "AI" ? "green" : "amber"} />
            <StatusBadge label={conversation.supportStatus} tone={conversation.supportStatus === "OPEN" ? "green" : conversation.supportStatus === "PENDING" ? "amber" : "slate"} />
            <StatusBadge label={conversation.priority} tone={conversation.priority === "urgent" ? "red" : conversation.priority === "high" ? "amber" : "slate"} />
            <StatusBadge label={conversation.company.aiEnabled ? "Empresa ativa" : "Empresa pausada"} tone={conversation.company.aiEnabled ? "green" : "red"} />
          </div>
        </section>
        <section className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-3">
          <h4 className="text-xs font-bold uppercase text-slate-400">Operacao</h4>
          <select value={conversation.supportStatus} onChange={(event) => onUpdate?.({ supportStatus: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-emerald-500" disabled={isSaving}>
            <option value="OPEN">Aberto</option>
            <option value="PENDING">Pendente</option>
            <option value="RESOLVED">Resolvido</option>
            <option value="ARCHIVED">Arquivado</option>
          </select>
          <select value={conversation.priority} onChange={(event) => onUpdate?.({ priority: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-emerald-500" disabled={isSaving}>
            <option value="low">Baixa</option>
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>
          <select value={conversation.assignedUserId ?? ""} onChange={(event) => onUpdate?.({ assignedUserId: event.target.value || null })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-emerald-500" disabled={isSaving}>
            <option value="">Sem responsavel</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </select>
          <input
            key={`tags-${conversation.id}-${conversation.tags.join("|")}`}
            defaultValue={conversation.tags.join(", ")}
            onBlur={(event) => onUpdate?.({ tags: event.currentTarget.value.split(",").map((tag) => tag.trim()).filter(Boolean) })}
            placeholder="Tags separadas por virgula"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-emerald-500"
            disabled={isSaving}
          />
        </section>
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase text-slate-400">Resumo automatico</h4>
          <p className="rounded-xl bg-slate-50 p-3 text-slate-600">{conversation.aiSummary ?? "Ainda sem resumo automatico."}</p>
        </section>
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase text-slate-400">Pedidos</h4>
          <div className="space-y-3">
            {conversation.restaurantOrders?.length ? conversation.restaurantOrders.slice(0, 3).map((order) => (
              <div key={order.id} className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-950">
                <div className="flex items-center justify-between gap-2">
                  <strong>#{order.id.slice(-6).toUpperCase()}</strong>
                  <StatusBadge label={order.status} tone={order.status === "confirmed" ? "green" : "amber"} />
                </div>
                <p className="mt-2 font-semibold">{order.fulfillmentType === "delivery" ? "Delivery" : "Retirada"}</p>
                <div className="mt-2 space-y-1">
                  {order.items.map((item) => <p key={item.id}>{item.quantity}x {item.name}</p>)}
                </div>
                {order.address && <p className="mt-2 text-emerald-800">Endereco: {order.address}</p>}
                {order.paymentMethod && <p className="text-emerald-800">Pagamento: {order.paymentMethod}</p>}
              </div>
            )) : <p className="text-slate-400">Nenhum pedido criado nesta conversa.</p>}
          </div>
        </section>
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase text-slate-400">Tags</h4>
          <div className="flex flex-wrap gap-2">
            {conversation.tags.length ? conversation.tags.map((tag) => <StatusBadge key={tag} label={tag} />) : <span className="text-slate-400">Sem tags.</span>}
          </div>
        </section>
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase text-slate-400">Observacoes internas</h4>
          <textarea
            key={`notes-${conversation.id}-${conversation.internalNotes ?? ""}`}
            defaultValue={conversation.internalNotes ?? ""}
            onBlur={(event) => onUpdate?.({ internalNotes: event.currentTarget.value || null })}
            placeholder="Sem observacoes."
            className="min-h-24 w-full rounded-xl bg-slate-50 p-3 text-slate-600 outline-none ring-1 ring-transparent focus:ring-emerald-200"
            disabled={isSaving}
          />
        </section>
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase text-slate-400">Documentos consultados</h4>
          <div className="space-y-2">
            {consultedDocs.length ? consultedDocs.map((doc, index) => <p key={`${doc}-${index}`} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{String(doc)}</p>) : <p className="text-slate-400">Nenhum documento registrado.</p>}
          </div>
        </section>
        {onForceTest && (
          <button onClick={onForceTest} className="w-full rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800">
            Forcar resposta de teste da IA
          </button>
        )}
      </div>
    </aside>
  );
}
