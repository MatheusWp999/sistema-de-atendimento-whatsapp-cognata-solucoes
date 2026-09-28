export const ConversationAIStatus = {
  AI_ACTIVE: "AI_ACTIVE",
  HUMAN_TAKEOVER: "HUMAN_TAKEOVER",
  AI_PAUSED_COMPANY: "AI_PAUSED_COMPANY",
  WAITING_HUMAN_REVIEW: "WAITING_HUMAN_REVIEW",
  AI_DISABLED: "AI_DISABLED",
} as const;

export const ConversationOwner = {
  AI: "AI",
  HUMAN: "HUMAN",
} as const;

export const SenderType = {
  CUSTOMER: "CUSTOMER",
  AI: "AI",
  HUMAN: "HUMAN",
  SYSTEM: "SYSTEM",
} as const;

export const KnowledgeTypes = [
  "PDF",
  "Informacoes da empresa",
  "Identidade e persona da IA",
  "Atividades da empresa",
  "Texto manual",
  "FAQ",
  "Script comercial",
  "Treinamento",
  "Produto",
  "Servico",
  "Produtos e servicos",
  "Politica interna",
  "Objecoes e respostas",
  "Informacao financeira",
  "Informacao juridica",
  "Processos operacionais",
  "Regras de atendimento",
  "Outro",
] as const;

export const DEFAULT_COMPANY_LIMITS = {
  dailyMessageLimit: 300,
  monthlyMessageLimit: 5000,
  dailyCostLimit: 20,
  monthlyCostLimit: 300,
};
