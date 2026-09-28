import type { Company, Conversation } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ConversationAIStatus, ConversationOwner } from "@/lib/constants";
import { BusinessModuleKey } from "./catalog";
import { getCompanyModuleConfig, isCompanyModuleEnabled } from "./module-registry.service";

type RestaurantOrdersConfig = {
  acceptDelivery?: boolean;
  acceptPickup?: boolean;
  requireHumanConfirmation?: boolean;
  deliveryFee?: number;
  paymentMethods?: string;
  confirmationMessage?: string;
  catalog?: unknown;
  menuItems?: unknown;
  products?: unknown;
  items?: unknown;
};

type DraftOrderItem = {
  name: string;
  quantity: number;
  notes?: string;
};

type DraftOrderData = {
  items?: DraftOrderItem[];
  fulfillmentType?: "delivery" | "pickup";
  address?: string;
  paymentMethod?: string;
  customerName?: string;
  notes?: string;
};

type ModuleResponse = {
  handled: boolean;
  content?: string;
  metadata?: Record<string, unknown>;
  needsHumanReview?: boolean;
};

const MIN_ITEM_QUANTITY = 1;
const MAX_ITEM_QUANTITY = 50;
const openStatuses = new Set(["collecting", "confirming"]);

function clampItemQuantity(quantity: number) {
  if (!Number.isFinite(quantity)) return MIN_ITEM_QUANTITY;
  return Math.min(Math.max(Math.trunc(quantity), MIN_ITEM_QUANTITY), MAX_ITEM_QUANTITY);
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isOrderIntent(message: string) {
  const text = normalizeText(message);
  return /\b(pedido|pedir|delivery|entrega|retirada|retirar|buscar|quero pedir|queria pedir|fazer um pedido)\b/.test(text);
}

function isCancelIntent(message: string) {
  return /\b(cancelar|cancela|desistir|deixa pra la|nao quero mais)\b/.test(normalizeText(message));
}

function isConfirmation(message: string) {
  const text = normalizeText(message).replace(/[,.!?;:]+/g, " ").replace(/\s+/g, " ").trim();
  if (/\b(nao|negativo|errado|incorreto|cancelar|cancela|desistir|alterar|mudar|trocar|corrigir|editar|remover|tirar|incluir|adicionar|acrescentar|ajustar|rever|espera|calma|perai|pera|mas|porem|so que|na verdade)\b/.test(text)) {
    return false;
  }
  return /^(sim|confirmo|confirmado|confirmar|pode confirmar|pode fechar|fechado|isso mesmo|correto|esta certo|ta certo|ok|okay)( o pedido| esse pedido| este pedido| meu pedido)?$/.test(text)
    || /^(sim|ok|okay) (pode confirmar|pode fechar|confirmar|fechar)( o pedido| esse pedido| este pedido| meu pedido)?$/.test(text);
}

function extractFulfillmentType(message: string): "delivery" | "pickup" | undefined {
  const text = normalizeText(message);
  if (/\b(delivery|entrega|entregar|receber em casa)\b/.test(text)) return "delivery";
  if (/\b(retirada|retirar|buscar|pegar ai|pegar no local)\b/.test(text)) return "pickup";
}

function extractPaymentMethod(message: string) {
  const text = normalizeText(message);
  if (/\bpix\b/.test(text)) return "Pix";
  if (/\bdinheiro\b/.test(text)) return "Dinheiro";
  if (/\b(cartao|credito|debito|maquininha)\b/.test(text)) return "Cartao";
}

function extractCustomerName(message: string) {
  const match = message.match(/(?:meu nome e|me chamo|sou o|sou a|aqui e)\s+(.+)/i);
  return match?.[1]?.trim().replace(/[.!?]+$/, "") || undefined;
}

function looksLikeAddress(message: string) {
  return /\b(rua|avenida|av\.?|travessa|bairro|numero|n\.?|casa|apto|apartamento|condominio|cep|quadra|lote)\b/i.test(message);
}

function extractAddress(message: string) {
  if (!looksLikeAddress(message)) return undefined;
  return message.trim().replace(/[.!?]+$/, "");
}

function quantityFromText(value: string) {
  const text = normalizeText(value);
  const numeric = text.match(/\b(\d+)\b/);
  if (numeric) return clampItemQuantity(Number(numeric[1]));
  if (/\b(dois|duas)\b/.test(text)) return 2;
  if (/\btres\b/.test(text)) return 3;
  if (/\bquatro\b/.test(text)) return 4;
  if (/\bcinco\b/.test(text)) return 5;
  return MIN_ITEM_QUANTITY;
}

function cleanItemName(value: string) {
  return value
    .replace(/\b(quero|queria|gostaria de|pedir|pedido|um|uma|dois|duas|tres|quatro|cinco|\d+|x|unidades?|por favor|pfv)\b/gi, " ")
    .replace(/\b(delivery|entrega|retirada|retirar|pix|dinheiro|cartao|credito|debito)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractItems(message: string) {
  const text = normalizeText(message);
  if (/\b(delivery|entrega|retirada|retirar|pix|dinheiro|cartao|credito|debito)\b/.test(text) && !/\b(quero|pedir|pedido|yakisoba|combo|prato|lanche|pizza|burger|hamburguer)\b/.test(text)) {
    return [];
  }

  const candidate = message
    .replace(/^(oi|ola|olá|bom dia|boa tarde|boa noite)[,!\s]*/i, "")
    .split(/,|\s\+\s|\se\s/i)
    .map((part) => part.trim())
    .filter(Boolean);

  return candidate
    .map((part) => ({ name: cleanItemName(part), quantity: quantityFromText(part) }))
    .filter((item) => item.name.length >= 2 && !/^pedido$/i.test(item.name));
}

function mergeItems(currentItems: DraftOrderItem[] | undefined, newItems: DraftOrderItem[]) {
  if (!newItems.length) return currentItems;
  const items = [...(currentItems ?? [])];
  for (const newItem of newItems) {
    const existing = items.find((item) => normalizeText(item.name) === normalizeText(newItem.name));
    if (existing) existing.quantity = clampItemQuantity(existing.quantity + newItem.quantity);
    else items.push({ ...newItem, quantity: clampItemQuantity(newItem.quantity) });
  }
  return items;
}

function hasStructuredCatalogPricing(config: RestaurantOrdersConfig) {
  return [config.catalog, config.menuItems, config.products, config.items].some((catalog) => {
    if (!Array.isArray(catalog)) return false;
    return catalog.some((item) => {
      if (!item || typeof item !== "object") return false;
      const record = item as Record<string, unknown>;
      const price = record.price ?? record.unitPrice;
      const numericPrice = typeof price === "number" ? price : typeof price === "string" ? Number(price.replace(",", ".")) : NaN;
      return typeof record.name === "string" && record.name.trim().length > 0 && Number.isFinite(numericPrice) && numericPrice >= 0;
    });
  });
}

function requiresHumanConfirmation(config: RestaurantOrdersConfig) {
  return config.requireHumanConfirmation === true || !hasStructuredCatalogPricing(config);
}

function formatItems(items: DraftOrderItem[] | undefined) {
  if (!items?.length) return "nenhum item informado";
  return items.map((item) => `${item.quantity}x ${item.name}`).join("\n");
}

function getNextStep(data: DraftOrderData) {
  if (!data.items?.length) return "collect_items";
  if (!data.fulfillmentType) return "collect_fulfillment";
  if (data.fulfillmentType === "delivery" && !data.address) return "collect_address";
  if (!data.paymentMethod) return "collect_payment";
  if (!data.customerName) return "collect_customer_name";
  return "confirm_order";
}

function buildQuestionForStep(step: string, config: RestaurantOrdersConfig) {
  if (step === "collect_items") return "Claro. Me fala quais itens voce quer pedir e a quantidade de cada um.";
  if (step === "collect_fulfillment") {
    if (config.acceptDelivery !== false && config.acceptPickup !== false) return "Vai ser delivery ou retirada?";
    if (config.acceptDelivery !== false) return "Perfeito. Me passa o endereco completo para entrega, por favor.";
    return "Perfeito. Vou considerar como retirada no local. Qual vai ser a forma de pagamento?";
  }
  if (step === "collect_address") return "Me passa o endereco completo para entrega, por favor.";
  if (step === "collect_payment") return `Qual vai ser a forma de pagamento?${config.paymentMethods ? ` Aceitamos: ${config.paymentMethods}.` : ""}`;
  if (step === "collect_customer_name") return "Em qual nome eu posso deixar o pedido?";
  return "Posso confirmar esse pedido?";
}

function buildConfirmationText(data: DraftOrderData, config: RestaurantOrdersConfig) {
  const deliveryFee = Number(config.deliveryFee ?? 0);
  const deliveryFeeLine = data.fulfillmentType === "delivery" && deliveryFee > 0 ? `\nTaxa de entrega: R$ ${deliveryFee.toFixed(2).replace(".", ",")}` : "";
  return [
    "Fechou. Confere pra mim antes de confirmar:",
    "",
    formatItems(data.items),
    `Tipo: ${data.fulfillmentType === "delivery" ? "delivery" : "retirada"}`,
    data.address ? `Endereco: ${data.address}` : undefined,
    `Pagamento: ${data.paymentMethod}`,
    `Nome: ${data.customerName}`,
    deliveryFeeLine.trim() || undefined,
    "",
    "Posso confirmar?",
  ].filter(Boolean).join("\n");
}

async function saveState(input: {
  companyId: string;
  conversationId: string;
  status: string;
  currentStep?: string;
  collectedData: DraftOrderData;
}) {
  return prisma.conversationModuleState.upsert({
    where: { conversationId_moduleKey: { conversationId: input.conversationId, moduleKey: BusinessModuleKey.RESTAURANT_ORDERS } },
    create: {
      companyId: input.companyId,
      conversationId: input.conversationId,
      moduleKey: BusinessModuleKey.RESTAURANT_ORDERS,
      status: input.status,
      currentStep: input.currentStep,
      collectedData: input.collectedData,
    },
    update: {
      status: input.status,
      currentStep: input.currentStep,
      collectedData: input.collectedData,
    },
  });
}

async function createRestaurantOrder(input: {
  company: Company;
  conversation: Conversation;
  data: DraftOrderData;
  config: RestaurantOrdersConfig;
}) {
  const deliveryFee = input.data.fulfillmentType === "delivery" ? Number(input.config.deliveryFee ?? 0) : 0;
  const shouldWaitForHuman = requiresHumanConfirmation(input.config);
  const status = shouldWaitForHuman ? "pending_human_confirmation" : "confirmed";
  return prisma.restaurantOrder.create({
    data: {
      companyId: input.company.id,
      conversationId: input.conversation.id,
      customerName: input.data.customerName,
      customerPhone: input.conversation.customerPhone,
      fulfillmentType: input.data.fulfillmentType ?? "delivery",
      address: input.data.address,
      paymentMethod: input.data.paymentMethod,
      notes: input.data.notes,
      status,
      deliveryFee,
      total: deliveryFee || null,
      rawData: input.data,
      confirmedAt: shouldWaitForHuman ? null : new Date(),
      items: {
        create: (input.data.items ?? []).map((item) => ({
          name: item.name,
          quantity: item.quantity,
          notes: item.notes,
        })),
      },
    },
    include: { items: true },
  });
}

export async function handleRestaurantOrderModule(input: {
  company: Company;
  conversation: Conversation;
  customerMessage: string;
}): Promise<ModuleResponse> {
  const enabled = await isCompanyModuleEnabled(input.company.id, BusinessModuleKey.RESTAURANT_ORDERS);
  if (!enabled) return { handled: false };

  const config = await getCompanyModuleConfig<RestaurantOrdersConfig>(input.company.id, BusinessModuleKey.RESTAURANT_ORDERS);
  const state = await prisma.conversationModuleState.findUnique({
    where: { conversationId_moduleKey: { conversationId: input.conversation.id, moduleKey: BusinessModuleKey.RESTAURANT_ORDERS } },
  });
  const hasOpenState = state ? openStatuses.has(state.status) : false;
  const cancelIntent = isCancelIntent(input.customerMessage);
  const orderIntent = isOrderIntent(input.customerMessage);

  if (cancelIntent) {
    if (hasOpenState) {
      const data = ((state?.collectedData as DraftOrderData | null) ?? {});
      await saveState({
        companyId: input.company.id,
        conversationId: input.conversation.id,
        status: "cancelled",
        currentStep: "cancelled",
        collectedData: data,
      });
      return {
        handled: true,
        content: "Tudo bem, cancelei esse pedido por aqui. Se quiser fazer outro, e so me chamar.",
        metadata: { moduleKey: BusinessModuleKey.RESTAURANT_ORDERS, moduleStatus: "cancelled" },
      };
    }

    if (state?.status === "completed") {
      await prisma.conversation.update({
        where: { id: input.conversation.id },
        data: { aiStatus: ConversationAIStatus.WAITING_HUMAN_REVIEW, currentOwner: ConversationOwner.HUMAN },
      });
      return {
        handled: true,
        content: "Vou chamar um atendente para verificar essa solicitacao no pedido.",
        metadata: { moduleKey: BusinessModuleKey.RESTAURANT_ORDERS, moduleStatus: "pending_human_review" },
        needsHumanReview: true,
      };
    }

    return { handled: false };
  }

  if (!hasOpenState && !orderIntent) return { handled: false };

  const data: DraftOrderData = hasOpenState ? ((state?.collectedData as DraftOrderData | null) ?? {}) : {};
  const currentStep = hasOpenState ? state?.currentStep : undefined;
  const fulfillmentType = extractFulfillmentType(input.customerMessage);
  const paymentMethod = extractPaymentMethod(input.customerMessage);
  const customerName = extractCustomerName(input.customerMessage);
  const address = extractAddress(input.customerMessage);

  if (fulfillmentType === "delivery" && config.acceptDelivery === false) {
    data.fulfillmentType = undefined;
    await saveState({ companyId: input.company.id, conversationId: input.conversation.id, status: "collecting", currentStep: "collect_fulfillment", collectedData: data });
    return { handled: true, content: "No momento nao estamos aceitando delivery por aqui. Pode ser retirada?", metadata: { moduleKey: BusinessModuleKey.RESTAURANT_ORDERS } };
  }

  if (fulfillmentType === "pickup" && config.acceptPickup === false) {
    data.fulfillmentType = undefined;
    await saveState({ companyId: input.company.id, conversationId: input.conversation.id, status: "collecting", currentStep: "collect_fulfillment", collectedData: data });
    return { handled: true, content: "No momento nao estamos trabalhando com retirada. Pode ser delivery?", metadata: { moduleKey: BusinessModuleKey.RESTAURANT_ORDERS } };
  }

  if (fulfillmentType) data.fulfillmentType = fulfillmentType;
  else if (!data.fulfillmentType && config.acceptDelivery !== false && config.acceptPickup === false) data.fulfillmentType = "delivery";
  else if (!data.fulfillmentType && config.acceptPickup !== false && config.acceptDelivery === false) data.fulfillmentType = "pickup";

  if (paymentMethod) data.paymentMethod = paymentMethod;
  if (customerName) data.customerName = customerName;
  else if (!data.customerName && input.conversation.customerName) data.customerName = input.conversation.customerName;
  if (address && (currentStep === "collect_address" || data.fulfillmentType === "delivery")) data.address = address;

  if (!data.items?.length || currentStep === "collect_items") {
    data.items = mergeItems(data.items, extractItems(input.customerMessage));
  }

  const nextStep = getNextStep(data);

  if (nextStep === "confirm_order") {
    if (currentStep === "confirm_order" && isConfirmation(input.customerMessage)) {
      const order = await createRestaurantOrder({ company: input.company, conversation: input.conversation, data, config });
      await saveState({
        companyId: input.company.id,
        conversationId: input.conversation.id,
        status: "completed",
        currentStep: "completed",
        collectedData: { ...data, orderId: order.id } as DraftOrderData,
      });

      const needsHumanReview = order.status === "pending_human_confirmation";

      if (needsHumanReview) {
        await prisma.conversation.update({
          where: { id: input.conversation.id },
          data: { aiStatus: ConversationAIStatus.WAITING_HUMAN_REVIEW, currentOwner: ConversationOwner.HUMAN },
        });
      }

      return {
        handled: true,
        content: needsHumanReview
          ? `Recebi sua solicitacao de pedido e deixei aguardando confirmacao de um atendente. Numero interno: ${order.id.slice(-6).toUpperCase()}.`
          : `${config.confirmationMessage ?? "Pedido confirmado. Vou encaminhar para preparo."}\nNumero interno: ${order.id.slice(-6).toUpperCase()}.`,
        metadata: { moduleKey: BusinessModuleKey.RESTAURANT_ORDERS, moduleStatus: order.status, orderId: order.id },
        needsHumanReview,
      };
    }

    await saveState({ companyId: input.company.id, conversationId: input.conversation.id, status: "confirming", currentStep: "confirm_order", collectedData: data });
    return {
      handled: true,
      content: buildConfirmationText(data, config),
      metadata: { moduleKey: BusinessModuleKey.RESTAURANT_ORDERS, moduleStatus: "confirming" },
    };
  }

  await saveState({ companyId: input.company.id, conversationId: input.conversation.id, status: "collecting", currentStep: nextStep, collectedData: data });
  return {
    handled: true,
    content: buildQuestionForStep(nextStep, config),
    metadata: { moduleKey: BusinessModuleKey.RESTAURANT_ORDERS, moduleStatus: "collecting", currentStep: nextStep },
  };
}
