"use client";

import { PauseCircle } from "lucide-react";
import { AIToggleButton } from "./AIToggleButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { ConversationDetailsDTO, WhatsAppQrStatusDTO } from "./types";

function qrStatusLabel(status?: WhatsAppQrStatusDTO["status"]) {
  if (status === "connected") return "WhatsApp QR conectado";
  if (status === "stale") return "WhatsApp QR instavel";
  if (status === "connecting") return "WhatsApp QR conectando";
  if (status === "qr") return "QR pendente";
  if (status === "disconnected") return "WhatsApp QR desconectado";
  if (status === "error") return "Erro no WhatsApp QR";
  return "WhatsApp QR inativo";
}

function qrStatusTone(status?: WhatsAppQrStatusDTO["status"]): "green" | "amber" | "red" | "blue" | "slate" {
  if (status === "connected") return "green";
  if (["connecting", "qr", "stale"].includes(status ?? "")) return "amber";
  if (["disconnected", "error"].includes(status ?? "")) return "red";
  return "slate";
}

export function ChatHeader({
  conversation,
  onTakeover,
  onReturnToAI,
  onToggleCompanyAI,
  whatsappQrStatus,
}: {
  conversation: ConversationDetailsDTO;
  onTakeover: () => void;
  onReturnToAI: () => void;
  onToggleCompanyAI: () => void;
  whatsappQrStatus?: WhatsAppQrStatusDTO;
}) {
  const lastSuccessfulCheck = whatsappQrStatus?.lastSuccessfulHealthCheckAt
    ? new Date(whatsappQrStatus.lastSuccessfulHealthCheckAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : undefined;

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
      <div>
        <h2 className="font-bold text-slate-900">{conversation.customerName ?? conversation.customerPhone}</h2>
        <p className="text-xs text-slate-500">
          {conversation.customerPhone} • {conversation.company.name}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <StatusBadge label={conversation.aiStatus} tone={conversation.aiStatus === "AI_ACTIVE" ? "green" : "amber"} />
          <StatusBadge label={conversation.company.aiEnabled ? "IA geral ativa" : "IA geral pausada"} tone={conversation.company.aiEnabled ? "green" : "red"} />
          <StatusBadge label={qrStatusLabel(whatsappQrStatus?.status)} tone={qrStatusTone(whatsappQrStatus?.status)} />
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          {whatsappQrStatus?.phoneNumber ? `Numero conectado: ${whatsappQrStatus.phoneNumber}` : "Numero QR ainda nao confirmado"}
          {lastSuccessfulCheck ? ` • ultima verificacao OK: ${lastSuccessfulCheck}` : ""}
          {whatsappQrStatus?.lastError ? ` • erro: ${whatsappQrStatus.lastError}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <AIToggleButton mode={conversation.currentOwner === "AI" ? "AI" : "HUMAN"} onTakeover={onTakeover} onReturnToAI={onReturnToAI} />
        <button onClick={onToggleCompanyAI} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <PauseCircle size={16} /> {conversation.company.aiEnabled ? "Pausar IA geral" : "Ativar IA geral"}
        </button>
      </div>
    </header>
  );
}
