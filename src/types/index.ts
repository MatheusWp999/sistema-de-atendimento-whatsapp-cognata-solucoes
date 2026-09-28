import type { Assistant, Company, Conversation, Message } from "@prisma/client";

export type CompanyWithAssistant = Company & { assistant: Assistant | null };
export type ConversationWithCompany = Conversation & {
  company: CompanyWithAssistant;
  messages?: Message[];
};

export type IncomingMessageInput = {
  companyId?: string;
  companyWhatsappNumber?: string;
  from: string;
  customerName?: string;
  contactAliases?: string[];
  message: string;
  externalId?: string;
};

export type GenerateResponseParams = {
  apiKey: string;
  model: string;
  prompt: string;
  systemPrompt?: string;
  userPrompt?: string;
  temperature?: number;
  maxTokens?: number;
};

export type GenerateResponseResult = {
  content: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  model: string;
};

export type GenerateEmbeddingParams = {
  apiKey: string;
  model: string;
  input: string;
};

export type RetrievedKnowledge = {
  content: string;
  title?: string;
  knowledgeItemId?: string;
  score?: number;
};

export type CompanyAIKnowledgeContext = {
  persona: string;
  rules: string;
  trainings: string;
  companyProfile: string;
};
