"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { truncateText } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { CompanyDTO, ConversationDTO } from "./types";

const ACTIVE_CUSTOMER_WINDOW_MS = 30 * 60 * 1000;

export function conversationTime(conversation: ConversationDTO) {
  return conversation.lastMessageAt ? new Date(conversation.lastMessageAt).getTime() : 0;
}

function lastCustomerMessageTime(conversation: ConversationDTO) {
  return conversation.lastCustomerMessageAt ? new Date(conversation.lastCustomerMessageAt).getTime() : 0;
}

function hasRecentCustomerActivity(conversation: ConversationDTO) {
  const time = lastCustomerMessageTime(conversation);
  if (!time) return false;
  return Date.now() - time < ACTIVE_CUSTOMER_WINDOW_MS;
}

export function isActiveConversation(conversation: ConversationDTO) {
  return conversation.unreadCount > 0 ||
    conversation.aiStatus === "WAITING_HUMAN_REVIEW" ||
    conversation.aiStatus === "HUMAN_TAKEOVER" ||
    conversation.currentOwner === "HUMAN" ||
    hasRecentCustomerActivity(conversation);
}

export function priorityScore(conversation: ConversationDTO, selectedConversationId?: string) {
  let score = conversationTime(conversation) / 10000000000000;
  if (conversation.id === selectedConversationId) score += 100;
  if (conversation.unreadCount > 0) score += 80;
  if (conversation.aiStatus === "WAITING_HUMAN_REVIEW") score += 70;
  if (conversation.currentOwner === "HUMAN") score += 60;
  if (conversation.aiStatus === "HUMAN_TAKEOVER") score += 50;
  if (hasRecentCustomerActivity(conversation)) score += 20;
  return score;
}

function ConversationRow({
  conversation,
  selectedConversationId,
  onSelectConversation,
  compact = false,
}: {
  conversation: ConversationDTO;
  selectedConversationId?: string;
  onSelectConversation: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <button
      onClick={() => onSelectConversation(conversation.id)}
      aria-pressed={selectedConversationId === conversation.id}
      className={`flex w-full gap-3 border-b border-slate-100 text-left hover:bg-emerald-50 ${compact ? "px-4 py-2 opacity-80" : "px-4 py-3"} ${selectedConversationId === conversation.id ? "bg-emerald-50 opacity-100" : ""}`}
    >
      <div className={`${compact ? "h-9 w-9 text-xs" : "h-12 w-12"} grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-700 font-bold text-white`}>
        {(conversation.customerName ?? conversation.customerPhone).slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <strong className={`${compact ? "text-xs" : "text-sm"} truncate text-slate-900`}>{conversation.customerName ?? conversation.customerPhone}</strong>
          <span className="text-[11px] text-slate-400">
            {conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
          </span>
        </div>
        <p className={`${compact ? "mt-0.5 text-[11px]" : "mt-1 text-xs"} text-slate-500`}>{truncateText(conversation.lastMessage, compact ? 44 : 58)}</p>
        {!compact && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge label={conversation.company.name} />
            <StatusBadge label={conversation.supportStatus} tone={conversation.supportStatus === "OPEN" ? "green" : conversation.supportStatus === "PENDING" ? "amber" : "slate"} />
            {conversation.priority !== "normal" && <StatusBadge label={conversation.priority} tone={conversation.priority === "urgent" ? "red" : "amber"} />}
            <StatusBadge label={conversation.currentOwner === "AI" ? "IA" : "Humano"} tone={conversation.currentOwner === "AI" ? "green" : "amber"} />
            {conversation.aiStatus === "WAITING_HUMAN_REVIEW" && <StatusBadge label="Aguardando humano" tone="red" />}
            {conversation.unreadCount > 0 && <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-xs text-white" aria-label={`${conversation.unreadCount} mensagens nao lidas`}>{conversation.unreadCount}</span>}
          </div>
        )}
      </div>
    </button>
  );
}

export function ConversationList({
  companies,
  conversations,
  selectedCompanyId,
  selectedConversationId,
  search,
  status,
  supportStatus,
  priority,
  onCompanyChange,
  onSearchChange,
  onStatusChange,
  onSupportStatusChange,
  onPriorityChange,
  onSelectConversation,
  onLoadMore,
  hasMore,
  isLoadingMore,
}: {
  companies: CompanyDTO[];
  conversations: ConversationDTO[];
  selectedCompanyId: string;
  selectedConversationId?: string;
  search: string;
  status: string;
  supportStatus: string;
  priority: string;
  onCompanyChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onSupportStatusChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
  onSelectConversation: (id: string) => void;
  onLoadMore: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}) {
  const [showInactive, setShowInactive] = useState(false);
  const activeConversations = conversations
    .filter((conversation) => isActiveConversation(conversation) || conversation.id === selectedConversationId)
    .sort((a, b) => priorityScore(b, selectedConversationId) - priorityScore(a, selectedConversationId));
  const inactiveConversations = conversations
    .filter((conversation) => !isActiveConversation(conversation) && conversation.id !== selectedConversationId)
    .sort((a, b) => conversationTime(b) - conversationTime(a));

  return (
    <aside aria-label="Lista de conversas" className="flex min-h-0 w-full flex-col border-r border-slate-200 bg-white md:w-[360px]">
      <div className="space-y-3 border-b border-slate-200 p-4">
        <label htmlFor="conversation-company-filter" className="sr-only">Filtrar conversas por empresa</label>
        <select
          id="conversation-company-filter"
          value={selectedCompanyId}
          onChange={(event) => onCompanyChange(event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-500"
        >
          <option value="">Todas as empresas</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-slate-500">
          <Search size={16} aria-hidden="true" />
          <label htmlFor="conversation-search" className="sr-only">Buscar conversa por contato ou telefone</label>
          <input
            id="conversation-search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar contato ou telefone"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <label htmlFor="conversation-status-filter" className="sr-only">Filtrar conversas por status</label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:grid-cols-1">
          <select
            id="conversation-status-filter"
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          >
            <option value="">IA: todas</option>
            <option value="AI_ACTIVE">IA ativa</option>
            <option value="HUMAN_TAKEOVER">Humano assumiu</option>
            <option value="WAITING_HUMAN_REVIEW">Aguardando humano</option>
            <option value="AI_PAUSED_COMPANY">IA geral pausada</option>
          </select>
          <select
            value={supportStatus}
            onChange={(event) => onSupportStatusChange(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            aria-label="Filtrar por status operacional"
          >
            <option value="">Atendimento: todos</option>
            <option value="OPEN">Aberto</option>
            <option value="PENDING">Pendente</option>
            <option value="RESOLVED">Resolvido</option>
            <option value="ARCHIVED">Arquivado</option>
          </select>
          <select
            value={priority}
            onChange={(event) => onPriorityChange(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            aria-label="Filtrar por prioridade"
          >
            <option value="">Prioridade: todas</option>
            <option value="urgent">Urgente</option>
            <option value="high">Alta</option>
            <option value="normal">Normal</option>
            <option value="low">Baixa</option>
          </select>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 backdrop-blur" role="status" aria-live="polite" aria-atomic="true">
          Ativas ({activeConversations.length})
        </div>
        {activeConversations.map((conversation) => (
          <ConversationRow key={conversation.id} conversation={conversation} selectedConversationId={selectedConversationId} onSelectConversation={onSelectConversation} />
        ))}
        {inactiveConversations.length > 0 && (
          <div className="border-t border-slate-200 bg-slate-50">
            <button
              onClick={() => setShowInactive((value) => !value)}
              aria-expanded={showInactive}
              aria-controls="inactive-conversations"
              className="flex w-full items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-100"
            >
              <span>Inativas minimizadas ({inactiveConversations.length})</span>
              <span>{showInactive ? "Ocultar" : "Mostrar"}</span>
            </button>
            {showInactive && (
              <div id="inactive-conversations">
                {inactiveConversations.map((conversation) => (
                  <ConversationRow key={conversation.id} conversation={conversation} selectedConversationId={selectedConversationId} onSelectConversation={onSelectConversation} compact />
                ))}
              </div>
            )}
          </div>
        )}
        {hasMore && (
          <div className="p-3">
            <button
              onClick={onLoadMore}
              disabled={isLoadingMore}
              aria-busy={isLoadingMore}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <span role={isLoadingMore ? "status" : undefined}>{isLoadingMore ? "Carregando..." : "Carregar mais conversas"}</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
