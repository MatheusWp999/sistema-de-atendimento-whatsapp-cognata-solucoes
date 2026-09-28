export type CompanyDTO = {
  id: string;
  name: string;
  whatsappNumber?: string | null;
  whatsappSessionEnabled?: boolean;
  whatsappConnectionStatus?: string;
  whatsappConnectedAt?: string | Date | null;
  whatsappLastSeenAt?: string | Date | null;
  whatsappLastError?: string | null;
  aiEnabled: boolean;
  aiProvider?: string;
  useOwnOpenAiKey?: boolean;
  useOwnOpenRouterKey?: boolean;
  openAiKeyMasked?: string;
  openRouterKeyMasked?: string;
  defaultAiModel?: string | null;
  fallbackAiModel?: string | null;
  embeddingModel?: string | null;
  openRouterModel?: string | null;
  description?: string | null;
  assistant?: AssistantDTO | null;
};

export type AssistantDTO = {
  id: string;
  name: string;
  role?: string | null;
  enabled: boolean;
  personality: string;
};

export type ConversationDTO = {
  id: string;
  companyId: string;
  customerName?: string | null;
  customerPhone: string;
  aiStatus: string;
  currentOwner: string;
  supportStatus: string;
  priority: string;
  assignedUserId?: string | null;
  assignedUser?: { id: string; name: string; email: string } | null;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  lastCustomerMessageAt?: string | null;
  lastReadAt?: string | null;
  unreadCount: number;
  tags: string[];
  internalNotes?: string | null;
  aiSummary?: string | null;
  company: CompanyDTO;
};

export type CompanyUserDTO = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
};

export type MessageDTO = {
  id: string;
  conversationId: string;
  companyId: string;
  senderType: "CUSTOMER" | "AI" | "HUMAN" | "SYSTEM";
  content: string;
  messageType: string;
  status: string;
  origin: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
  claimedAt?: string | null;
  nextAttemptAt?: string | null;
};

export type RestaurantOrderItemDTO = {
  id: string;
  name: string;
  quantity: number;
  unitPrice?: number | null;
  notes?: string | null;
};

export type RestaurantOrderDTO = {
  id: string;
  status: string;
  fulfillmentType: string;
  address?: string | null;
  paymentMethod?: string | null;
  customerName?: string | null;
  deliveryFee?: number | null;
  total?: number | null;
  createdAt: string;
  items: RestaurantOrderItemDTO[];
};

export type ConversationDetailsDTO = ConversationDTO & {
  messages: MessageDTO[];
  messagesNextCursor?: string | null;
  messagesHasMore?: boolean;
  restaurantOrders?: RestaurantOrderDTO[];
};

export type PaginatedConversationsDTO = {
  items: ConversationDTO[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type WhatsAppQrStatusDTO = {
  companyId: string;
  status: "idle" | "connecting" | "qr" | "connected" | "stale" | "disconnected" | "error";
  qrCodeDataUrl?: string;
  phoneNumber?: string;
  startedAt?: string;
  lastError?: string;
  lastHealthCheckAt?: string;
  lastSuccessfulHealthCheckAt?: string;
  healthFailures?: number;
};
