"use client";

import { Paperclip, Send, Smile } from "lucide-react";
import { useState } from "react";

export function ChatInput({
  manualDisabled,
  manualPending,
  onSendManual,
  onSimulateCustomer,
}: {
  manualDisabled: boolean;
  manualPending?: boolean;
  onSendManual: (content: string) => void | Promise<unknown>;
  onSimulateCustomer: (content: string) => void;
}) {
  const [manual, setManual] = useState("");
  const [mock, setMock] = useState("");
  const manualCanSend = Boolean(manual.trim()) && !manualDisabled && !manualPending;
  const canUseTestTools = process.env.NEXT_PUBLIC_ENABLE_CHAT_TEST_TOOLS === "true" || process.env.NODE_ENV !== "production";

  const handleSendManual = async () => {
    const content = manual.trim();
    if (!content) return;

    try {
      await onSendManual(content);
      setManual("");
    } catch {
      // Keep the draft so the operator can retry after a failed manual send.
    }
  };

  return (
    <div className="border-t border-slate-200 bg-slate-50 p-3">
      {manualDisabled && (
        <div className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900" role="alert">
          A IA esta ativa nesta conversa. Para responder manualmente, clique em Assumir conversa.
        </div>
      )}
      <div className="flex items-center gap-2">
        <button type="button" disabled className="rounded-full p-2 text-slate-500 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Emoji indisponivel">
          <Smile size={20} />
        </button>
        <button type="button" disabled className="rounded-full p-2 text-slate-500 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Anexo indisponivel">
          <Paperclip size={20} />
        </button>
        <label htmlFor="manual-chat-message" className="sr-only">Mensagem manual para enviar ao cliente</label>
        <input
          id="manual-chat-message"
          value={manual}
          onChange={(event) => setManual(event.target.value)}
          disabled={!manualCanSend}
          placeholder={manualDisabled ? "Envio manual bloqueado" : "Digite uma resposta manual"}
          className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-black placeholder:text-slate-500 outline-none focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-700"
        />
        <button
          type="button"
          onClick={handleSendManual}
          disabled={manualDisabled || manualPending}
          className="rounded-full bg-emerald-700 p-2 text-white hover:bg-emerald-800 disabled:opacity-50"
          aria-label="Enviar"
        >
          <Send size={18} />
        </button>
        {manualPending && <span className="sr-only" role="status">Enviando resposta manual</span>}
      </div>
      {canUseTestTools && (
        <div className="mt-2 flex gap-2">
          <label htmlFor="mock-customer-message" className="sr-only">Mensagem para simular cliente no modo local</label>
          <input
            id="mock-customer-message"
            value={mock}
            onChange={(event) => setMock(event.target.value)}
            placeholder="Simular mensagem do cliente no modo local"
            className="min-w-0 flex-1 rounded-full border border-dashed border-slate-300 bg-white px-4 py-2 text-xs text-black placeholder:text-slate-500 outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={() => {
              if (!mock.trim()) return;
              onSimulateCustomer(mock.trim());
              setMock("");
            }}
            className="rounded-full bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900"
          >
            Simular cliente
          </button>
        </div>
      )}
    </div>
  );
}
