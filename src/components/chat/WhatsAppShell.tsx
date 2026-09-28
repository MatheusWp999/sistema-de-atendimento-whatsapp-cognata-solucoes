"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ConversationList } from "./ConversationList";
import { ConversationWindow } from "./ConversationWindow";
import { ConversationDetails } from "./ConversationDetails";
import type { CompanyDTO, CompanyUserDTO, ConversationDetailsDTO, MessageDTO, PaginatedConversationsDTO, WhatsAppQrStatusDTO } from "./types";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!response.ok) throw new Error((await response.json()).error ?? "Erro na requisicao");
  return response.json();
}

function buildConversationUrl(companyId: string, search: string, status: string, supportStatus: string, priority: string, cursor?: string) {
  const params = new URLSearchParams({ limit: "50" });
  if (companyId) params.set("companyId", companyId);
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  if (supportStatus) params.set("supportStatus", supportStatus);
  if (priority) params.set("priority", priority);
  if (cursor) params.set("cursor", cursor);
  return `/api/conversations?${params.toString()}`;
}

function combineConversationPages(pages?: ConversationDetailsDTO[]): ConversationDetailsDTO | undefined {
  const firstPage = pages?.[0];
  if (!firstPage) return undefined;

  const seen = new Set<string>();
  const messages: MessageDTO[] = [];
  for (const page of [...pages].reverse()) {
    for (const message of page.messages) {
      if (seen.has(message.id)) continue;
      seen.add(message.id);
      messages.push(message);
    }
  }

  const oldestPage = pages[pages.length - 1];
  return {
    ...firstPage,
    messages,
    messagesNextCursor: oldestPage?.messagesNextCursor ?? null,
    messagesHasMore: oldestPage?.messagesHasMore ?? false,
  };
}

export function WhatsAppShell() {
  const queryClient = useQueryClient();
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<string>();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [supportStatus, setSupportStatus] = useState("");
  const [priority, setPriority] = useState("");
  const canForceTest = process.env.NEXT_PUBLIC_ENABLE_CHAT_TEST_TOOLS === "true" || process.env.NODE_ENV !== "production";

  const companies = useQuery({ queryKey: ["companies"], queryFn: () => api<CompanyDTO[]>("/api/companies") });
  const conversations = useInfiniteQuery({
    queryKey: ["conversations", selectedCompanyId, search, status, supportStatus, priority],
    queryFn: ({ pageParam }) => api<PaginatedConversationsDTO>(buildConversationUrl(selectedCompanyId, search, status, supportStatus, priority, pageParam || undefined)),
    initialPageParam: "",
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchInterval: 2500,
  });
  const conversationItems = conversations.data?.pages.flatMap((page) => page.items) ?? [];
  const selectedConversationIsInCurrentSet = !selectedConversationId ||
    !conversations.isSuccess ||
    conversations.isFetching ||
    conversations.data.pages.some((page) => page.items.some((conversation) => conversation.id === selectedConversationId));
  const activeConversationId = selectedConversationIsInCurrentSet ? selectedConversationId : undefined;
  const selectedConversation = useInfiniteQuery({
    queryKey: ["conversation", activeConversationId],
    queryFn: ({ pageParam }) => {
      const cursor = pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : "";
      return api<ConversationDetailsDTO>(`/api/conversations/${activeConversationId}?limit=100${cursor}`);
    },
    initialPageParam: "",
    getNextPageParam: (lastPage) => lastPage.messagesNextCursor ?? undefined,
    enabled: Boolean(activeConversationId),
    refetchInterval: 2000,
  });
  const selectedConversationDetails = activeConversationId ? combineConversationPages(selectedConversation.data?.pages) : undefined;
  const whatsappQrCompanyId = selectedConversationDetails?.company.id ?? selectedCompanyId;
  const companyUsers = useQuery({
    queryKey: ["company-users", selectedConversationDetails?.company.id],
    queryFn: () => api<CompanyUserDTO[]>(`/api/company-users?companyId=${selectedConversationDetails?.company.id}`),
    enabled: Boolean(selectedConversationDetails?.company.id),
  });
  const whatsappQrStatus = useQuery({
    queryKey: ["whatsapp-qr-status", whatsappQrCompanyId],
    queryFn: () => api<WhatsAppQrStatusDTO>(`/api/whatsapp-qr/status?companyId=${whatsappQrCompanyId}`),
    enabled: Boolean(whatsappQrCompanyId),
    refetchInterval: 2500,
  });

  const refresh = (conversationId = activeConversationId) => {
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    if (conversationId) queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
  };

  const { mutate: markConversationRead } = useMutation({
    mutationFn: (conversationId: string) => api(`/api/conversations/${conversationId}/read`, { method: "PATCH" }),
    onSuccess: (_data, conversationId) => refresh(conversationId),
  });
  const takeover = useMutation({ mutationFn: () => api(`/api/conversations/${activeConversationId}/takeover`, { method: "PATCH" }), onSuccess: () => refresh() });
  const returnToAI = useMutation({ mutationFn: () => api(`/api/conversations/${activeConversationId}/return-to-ai`, { method: "PATCH" }), onSuccess: () => refresh() });
  const sendManual = useMutation({
    mutationFn: (content: string) => api(`/api/conversations/${activeConversationId}/messages`, { method: "POST", body: JSON.stringify({ content }) }),
    onSuccess: () => refresh(),
    onError: (error) => alert(error instanceof Error ? error.message : "Erro ao enviar mensagem manual"),
  });
  const simulateCustomer = useMutation({
    mutationFn: (content: string) => api(`/api/conversations/${activeConversationId}/mock-client-message`, { method: "POST", body: JSON.stringify({ content }) }),
    onSuccess: () => refresh(),
    onError: (error) => alert(error instanceof Error ? error.message : "Erro ao simular mensagem"),
  });
  const toggleCompanyAI = useMutation({
    mutationFn: () =>
      api(`/api/companies/${selectedConversationDetails?.company.id}/ai-status`, {
        method: "PATCH",
        body: JSON.stringify({ aiEnabled: !selectedConversationDetails?.company.aiEnabled }),
      }),
    onSuccess: () => refresh(),
  });
  const retryMessage = useMutation({
    mutationFn: (messageId: string) => api(`/api/messages/${messageId}/retry`, { method: "POST" }),
    onSuccess: () => refresh(),
    onError: (error) => alert(error instanceof Error ? error.message : "Erro ao reenviar mensagem"),
  });
  const updateConversation = useMutation({
    mutationFn: (payload: Partial<ConversationDetailsDTO>) => api(`/api/conversations/${activeConversationId}`, { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: () => refresh(),
    onError: (error) => alert(error instanceof Error ? error.message : "Erro ao atualizar conversa"),
  });

  useEffect(() => {
    if (selectedConversationIsInCurrentSet) return;

    const timeout = window.setTimeout(() => {
      setSelectedConversationId(undefined);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [selectedConversationIsInCurrentSet]);

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    markConversationRead(conversationId);
  };

  return (
    <div className="flex h-[calc(100vh-56px)] min-h-[620px] overflow-hidden bg-white">
      <div className={`${activeConversationId ? "hidden md:flex" : "flex"} min-h-0`}>
      <ConversationList
        companies={companies.data ?? []}
        conversations={conversationItems}
        selectedCompanyId={selectedCompanyId}
        selectedConversationId={activeConversationId}
        search={search}
        status={status}
        supportStatus={supportStatus}
        priority={priority}
        onCompanyChange={setSelectedCompanyId}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
        onSupportStatusChange={setSupportStatus}
        onPriorityChange={setPriority}
        onSelectConversation={handleSelectConversation}
        onLoadMore={() => conversations.fetchNextPage()}
        hasMore={conversations.hasNextPage}
        isLoadingMore={conversations.isFetchingNextPage}
      />
      </div>
      <div className={`${activeConversationId ? "flex" : "hidden md:flex"} min-h-0 flex-1`}>
      <ConversationWindow
        conversation={selectedConversationDetails}
        isAITyping={simulateCustomer.isPending}
        onTakeover={() => takeover.mutate()}
        onReturnToAI={() => returnToAI.mutate()}
        onToggleCompanyAI={() => toggleCompanyAI.mutate()}
        onSendManual={(content) => sendManual.mutateAsync(content)}
        onSimulateCustomer={(content) => simulateCustomer.mutate(content)}
        onRetryMessage={(messageId) => retryMessage.mutate(messageId)}
        onLoadMoreMessages={() => selectedConversation.fetchNextPage()}
        onBackToList={() => setSelectedConversationId(undefined)}
        manualPending={sendManual.isPending}
        isLoadingMoreMessages={selectedConversation.isFetchingNextPage}
        whatsappQrStatus={whatsappQrStatus.data}
      />
      </div>
      <ConversationDetails
        conversation={selectedConversationDetails}
        users={companyUsers.data ?? []}
        onUpdate={(payload) => updateConversation.mutate(payload)}
        isSaving={updateConversation.isPending}
        onForceTest={canForceTest ? () => simulateCustomer.mutate("Pode gerar uma resposta de teste com base no contexto?") : undefined}
      />
    </div>
  );
}
