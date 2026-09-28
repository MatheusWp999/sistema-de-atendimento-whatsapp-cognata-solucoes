"use client";

import { cn } from "@/lib/utils";
import type { MessageDTO } from "./types";

function deliveryLabel(status: string) {
  if (status === "queued") return "na fila";
  if (status === "sending") return "enviando";
  if (status === "sent") return "enviado";
  if (status === "failed_retryable") return "falha, tentando novamente";
  if (status === "failed_final") return "falha final";
  if (status === "error") return "erro";
  return status;
}

function isFailed(status: string) {
  return ["failed_retryable", "failed_final", "error"].includes(status);
}

export function MessageBubble({
  message,
  assistantName,
  onRetry,
}: {
  message: MessageDTO;
  assistantName?: string;
  onRetry?: (messageId: string) => void;
}) {
  if (message.senderType === "SYSTEM") {
    return <div className="mx-auto my-2 max-w-[80%] rounded-full bg-amber-100 px-4 py-1 text-center text-xs text-amber-800">{message.content}</div>;
  }

  const isOutbound = message.senderType === "AI" || message.senderType === "HUMAN";
  const label = message.senderType === "CUSTOMER" ? "Cliente" : message.senderType === "AI" ? assistantName ?? "IA" : "Operador humano";

  return (
    <div className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-4 py-2 shadow-sm",
          isOutbound ? "rounded-tr-sm bg-emerald-100 text-slate-900" : "rounded-tl-sm bg-white text-slate-900",
          message.senderType === "HUMAN" && "bg-blue-100",
        )}
      >
        <div className="mb-1 text-[11px] font-semibold text-slate-500">{label}</div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        <div className="mt-1 flex items-center justify-end gap-2 text-[10px] text-slate-400">
          {isOutbound && <span className={cn(isFailed(message.status) && "font-semibold text-red-600")}>{deliveryLabel(message.status)}</span>}
          <span>{new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        {isOutbound && isFailed(message.status) && onRetry && (
          <button
            type="button"
            onClick={() => onRetry(message.id)}
            className="mt-2 rounded-full border border-red-200 bg-white px-3 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50"
          >
            Reenviar
          </button>
        )}
      </div>
    </div>
  );
}
