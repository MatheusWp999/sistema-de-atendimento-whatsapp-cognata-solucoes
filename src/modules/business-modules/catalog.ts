export const BusinessModuleKey = {
  KNOWLEDGE_QA: "knowledge_qa",
  HUMAN_TAKEOVER: "human_takeover",
  RESTAURANT_MENU: "restaurant_menu",
  RESTAURANT_ORDERS: "restaurant_orders",
  RESTAURANT_RESERVATIONS: "restaurant_reservations",
  LEAD_CAPTURE: "lead_capture",
  QUOTE_REQUEST: "quote_request",
  APPOINTMENT_BOOKING: "appointment_booking",
  SUPPORT_TICKET: "support_ticket",
} as const;

export type BusinessModuleKey = (typeof BusinessModuleKey)[keyof typeof BusinessModuleKey];

export type BusinessModuleDefinition = {
  key: BusinessModuleKey;
  name: string;
  category: string;
  description: string;
  defaultEnabled: boolean;
  configurable: boolean;
  configSchema: Array<{
    key: string;
    label: string;
    type: "boolean" | "text" | "number" | "select";
    description?: string;
    defaultValue?: string | number | boolean;
    options?: string[];
  }>;
};

export const businessModuleCatalog: BusinessModuleDefinition[] = [
  {
    key: BusinessModuleKey.KNOWLEDGE_QA,
    name: "Conhecimento e FAQ",
    category: "Base",
    description: "Responde duvidas usando persona, treinamentos, PDFs e base de conhecimento da empresa.",
    defaultEnabled: true,
    configurable: false,
    configSchema: [],
  },
  {
    key: BusinessModuleKey.HUMAN_TAKEOVER,
    name: "Atendimento humano",
    category: "Base",
    description: "Permite transferir, pausar IA e registrar casos que precisam de uma pessoa.",
    defaultEnabled: true,
    configurable: false,
    configSchema: [],
  },
  {
    key: BusinessModuleKey.RESTAURANT_MENU,
    name: "Cardapio estruturado",
    category: "Restaurante",
    description: "Organiza produtos, categorias, disponibilidade e recomendacoes de cardapio.",
    defaultEnabled: false,
    configurable: true,
    configSchema: [
      { key: "allowSuggestions", label: "Permitir sugestoes", type: "boolean", defaultValue: true },
      { key: "showPrices", label: "Informar precos", type: "boolean", defaultValue: true },
    ],
  },
  {
    key: BusinessModuleKey.RESTAURANT_ORDERS,
    name: "Pedidos / Delivery",
    category: "Restaurante",
    description: "Coleta itens, entrega ou retirada, endereco, pagamento e confirmacao do pedido pelo WhatsApp.",
    defaultEnabled: false,
    configurable: true,
    configSchema: [
      { key: "acceptDelivery", label: "Aceita delivery", type: "boolean", defaultValue: true },
      { key: "acceptPickup", label: "Aceita retirada", type: "boolean", defaultValue: true },
      { key: "requireHumanConfirmation", label: "Exigir confirmacao humana", type: "boolean", defaultValue: false },
      { key: "deliveryFee", label: "Taxa de entrega padrao", type: "number", defaultValue: 0 },
      { key: "paymentMethods", label: "Formas de pagamento", type: "text", defaultValue: "Pix, dinheiro, cartao" },
      { key: "confirmationMessage", label: "Mensagem apos confirmar", type: "text", defaultValue: "Pedido confirmado. Vou encaminhar para preparo." },
    ],
  },
  {
    key: BusinessModuleKey.RESTAURANT_RESERVATIONS,
    name: "Reservas de mesa",
    category: "Restaurante",
    description: "Coleta data, horario, quantidade de pessoas e observacoes para reserva.",
    defaultEnabled: false,
    configurable: true,
    configSchema: [
      { key: "requireHumanConfirmation", label: "Exigir confirmacao humana", type: "boolean", defaultValue: true },
    ],
  },
  {
    key: BusinessModuleKey.LEAD_CAPTURE,
    name: "Captacao de leads",
    category: "Comercial",
    description: "Coleta nome, interesse, contato, urgencia e origem do lead.",
    defaultEnabled: false,
    configurable: true,
    configSchema: [],
  },
  {
    key: BusinessModuleKey.QUOTE_REQUEST,
    name: "Orcamentos",
    category: "Comercial",
    description: "Padroniza pedidos de orcamento e coleta dados tecnicos antes de encaminhar.",
    defaultEnabled: false,
    configurable: true,
    configSchema: [],
  },
  {
    key: BusinessModuleKey.APPOINTMENT_BOOKING,
    name: "Agendamentos",
    category: "Servicos",
    description: "Coleta servico, profissional, data, horario, nome e telefone.",
    defaultEnabled: false,
    configurable: true,
    configSchema: [],
  },
  {
    key: BusinessModuleKey.SUPPORT_TICKET,
    name: "Suporte / chamados",
    category: "Atendimento",
    description: "Coleta problema, prioridade, evidencias e status de atendimento.",
    defaultEnabled: false,
    configurable: true,
    configSchema: [],
  },
];

export function getBusinessModuleDefinition(key: string) {
  return businessModuleCatalog.find((module) => module.key === key);
}

export function buildDefaultModuleConfig(definition: BusinessModuleDefinition) {
  return Object.fromEntries(definition.configSchema.map((field) => [field.key, field.defaultValue ?? null]));
}
