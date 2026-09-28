"use client";

import { MessageList, TypingIndicator } from "@chatscope/chat-ui-kit-react";
import { MessageBubble } from "./MessageBubble";
import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import type { ConversationDetailsDTO, WhatsAppQrStatusDTO } from "./types";

export function ConversationWindow({
  conversation,
  isAITyping,
  onTakeover,
  onReturnToAI,
  onToggleCompanyAI,
  onSendManual,
  onSimulateCustomer,
  onRetryMessage,
  onLoadMoreMessages,
  onBackToList,
  manualPending,
  isLoadingMoreMessages,
  whatsappQrStatus,
}: {
  conversation?: ConversationDetailsDTO;
  isAITyping: boolean;
  onTakeover: () => void;
  onReturnToAI: () => void;
  onToggleCompanyAI: () => void;
  onSendManual: (content: string) => void;
  onSimulateCustomer: (content: string) => void;
  onRetryMessage: (messageId: string) => void;
  onLoadMoreMessages: () => void;
  onBackToList?: () => void;
  manualPending?: boolean;
  isLoadingMoreMessages?: boolean;
  whatsappQrStatus?: WhatsAppQrStatusDTO;
}) {
  if (!conversation) {
    return <section className="grid min-h-0 flex-1 place-items-center bg-[#efeae2] text-slate-500">Selecione uma conversa para iniciar.</section>;
  }

  const manualDisabled = conversation.company.aiEnabled && conversation.aiStatus === "AI_ACTIVE" && conversation.currentOwner === "AI";

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-[#efeae2]">
      <ChatHeader conversation={conversation} onTakeover={onTakeover} onReturnToAI={onReturnToAI} onToggleCompanyAI={onToggleCompanyAI} whatsappQrStatus={whatsappQrStatus} />
      <button type="button" onClick={onBackToList} className="border-b border-slate-200 bg-white px-4 py-2 text-left text-xs font-bold text-slate-600 md:hidden">
        Voltar para conversas
      </button>
      <div className="min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,.45),transparent_24%),#efeae2] p-4">
        <MessageList autoScrollToBottom autoScrollToBottomOnMount typingIndicator={isAITyping ? <TypingIndicator content="IA digitando..." /> : undefined}>
          <div className="space-y-3 px-1 py-3">
            {conversation.messagesHasMore && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={onLoadMoreMessages}
                  disabled={isLoadingMoreMessages}
                  className="rounded-full border border-slate-200 bg-white/90 px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-sm hover:bg-white disabled:opacity-50"
                >
                  {isLoadingMoreMessages ? "Carregando..." : "Carregar mensagens antigas"}
                </button>
              </div>
            )}
            {conversation.messages.map((message) => (
              <MessageBubble key={message.id} message={message} assistantName={conversation.company.assistant?.name} onRetry={onRetryMessage} />
            ))}
          </div>
        </MessageList>
      </div>
      <ChatInput manualDisabled={manualDisabled} manualPending={manualPending} onSendManual={onSendManual} onSimulateCustomer={onSimulateCustomer} />
    </section>
  );
}
