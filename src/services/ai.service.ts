import type { Assistant, Company, Conversation, Message, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildWhatsAppAttendantPrompt } from "@/modules/ai/prompts/whatsapp-attendant.prompt";
import { resolveAIConfig } from "@/modules/ai/ai-provider.factory";
import { estimateOpenAICost, logAIUsage } from "@/services/usage.service";
import type { CompanyAIKnowledgeContext, RetrievedKnowledge } from "@/types";

const HUMAN_REVIEW_MARKER = "[HUMAN_REVIEW_REQUIRED]";
const PRICE_PATTERN = /(?:r\$\s*\d+|\b\d{1,4}[,.]\d{2}\b)/i;

export const SAFE_HUMAN_REVIEW_MESSAGE =
  "Entendi. Para te passar essa informação com segurança, vou encaminhar sua conversa para um atendente responsável.";

const SAFE_MENU_PRICE_MESSAGE =
  "Encontrei referência de preço no material, mas para não te passar um valor desatualizado ou fora do cardápio oficial, preciso confirmar com um atendente ou consultar o cardápio oficial antes.";

function normalizePortugueseAccents(content: string) {
  const replacements: Array<[RegExp, string]> = [
    [/\bVoce\b/g, "Você"],
    [/\bvoce\b/g, "você"],
    [/\bVoces\b/g, "Vocês"],
    [/\bvoces\b/g, "vocês"],
    [/\bNao\b/g, "Não"],
    [/\bnao\b/g, "não"],
    [/\bOla\b/g, "Olá"],
    [/\bola\b/g, "olá"],
    [/\bcardapio\b/g, "cardápio"],
    [/\bCardapio\b/g, "Cardápio"],
    [/\bopcao\b/g, "opção"],
    [/\bopcoes\b/g, "opções"],
    [/\bOpcao\b/g, "Opção"],
    [/\bOpcoes\b/g, "Opções"],
    [/\btambem\b/g, "também"],
    [/\bTambem\b/g, "Também"],
    [/\bsugestao\b/g, "sugestão"],
    [/\bsugestoes\b/g, "sugestões"],
    [/\bSugestao\b/g, "Sugestão"],
    [/\bSugestoes\b/g, "Sugestões"],
    [/\bespecifico\b/g, "específico"],
    [/\bespecifica\b/g, "específica"],
    [/\bEspecifico\b/g, "Específico"],
    [/\bEspecifica\b/g, "Específica"],
    [/\binformacao\b/g, "informação"],
    [/\binformacoes\b/g, "informações"],
    [/\bInformacao\b/g, "Informação"],
    [/\bInformacoes\b/g, "Informações"],
    [/\bseguranca\b/g, "segurança"],
    [/\bSeguranca\b/g, "Segurança"],
    [/\bduvida\b/g, "dúvida"],
    [/\bduvidas\b/g, "dúvidas"],
    [/\bDuvida\b/g, "Dúvida"],
    [/\bDuvidas\b/g, "Dúvidas"],
    [/\bproximo\b/g, "próximo"],
    [/\bproxima\b/g, "próxima"],
    [/\bproximos\b/g, "próximos"],
    [/\bproximas\b/g, "próximas"],
    [/\bProximo\b/g, "Próximo"],
    [/\bProxima\b/g, "Próxima"],
    [/\bdisposicao\b/g, "disposição"],
    [/\bDisposicao\b/g, "Disposição"],
    [/\bexperiencia\b/g, "experiência"],
    [/\bExperiencia\b/g, "Experiência"],
    [/\bhorario\b/g, "horário"],
    [/\bHorario\b/g, "Horário"],
    [/\bendereco\b/g, "endereço"],
    [/\bEndereco\b/g, "Endereço"],
    [/\blocalizacao\b/g, "localização"],
    [/\bLocalizacao\b/g, "Localização"],
    [/\bproprio\b/g, "próprio"],
    [/\bProprio\b/g, "Próprio"],
    [/\bocasiao\b/g, "ocasião"],
    [/\bOcasiao\b/g, "Ocasião"],
    [/\balem\b/g, "além"],
    [/\bAlem\b/g, "Além"],
    [/\bcomunicacao\b/g, "comunicação"],
    [/\bComunicacao\b/g, "Comunicação"],
    [/\baniversario\b/g, "aniversário"],
    [/\bAniversario\b/g, "Aniversário"],
    [/\bcombinacao\b/g, "combinação"],
    [/\bcombinacoes\b/g, "combinações"],
    [/\bCombinacao\b/g, "Combinação"],
    [/\bCombinacoes\b/g, "Combinações"],
  ];

  return replacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), content).normalize("NFC");
}

function normalizeForIntent(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function shouldKeepAiForClarification(message: string) {
  const value = normalizeForIntent(message);
  return /\b(oi|ola|bom dia|boa tarde|boa noite)\b/.test(value) ||
    /\b(cardapio|menu|pedido|pedir|delivery|reserva|reservar|mesa|conhecer|de onde|onde fica|endereco|contato|whatsapp|telefone|quem e|quem sao|o que e|como funciona|quero informacoes|pode ajudar|me ajuda)\b/.test(value);
}

function buildClarificationResponse(message: string, companyName: string) {
  const value = normalizeForIntent(message);
  if (/\b(de onde|onde fica|endereco)\b/.test(value)) {
    return `Eu queria te passar isso certinho, mas ainda não tenho o endereço cadastrado aqui. Você quer a localização da unidade ou prefere falar sobre cardápio, pedido ou reserva?`;
  }

  if (/\b(oi|ola|bom dia|boa tarde|boa noite)\b/.test(value)) {
    return `Oi! Seja bem-vindo ao ${companyName}. Me conta o que você está procurando hoje que eu te ajudo por aqui.`;
  }

  return `Entendi. Me dá só um pouco mais de contexto para eu te orientar melhor com as informações que tenho aqui.`;
}

function buildNonBlockingFallback(message: string) {
  const value = normalizeForIntent(message);
  if (/\b(preco|valor|quanto custa|cardapio|menu)\b/.test(value)) {
    return `Posso te ajudar sim. Me diz se você quer uma sugestão para comer agora ou se tem algum item específico em mente que eu procuro no cardápio.`;
  }

  if (/\b(horario|funcionamento|abre|fecha)\b/.test(value)) {
    return `Consigo te ajudar, mas preciso saber de qual unidade ou data você está falando para não te passar uma informação incompleta.`;
  }

  if (/\b(reserva|reservar|mesa)\b/.test(value)) {
    return `Posso conduzir sua reserva por aqui. Me passa o dia, horário e quantidade de pessoas que eu te ajudo com o próximo passo.`;
  }

  return `Posso te ajudar por aqui. Me conta um pouco melhor o que você precisa e eu vejo a melhor forma de te orientar.`;
}

function shouldUseLocationClarification(message: string, response: string) {
  const messageValue = normalizeForIntent(message);
  const responseValue = normalizeForIntent(response);
  return /\b(de onde|onde fica|endereco)\b/.test(messageValue) &&
    !/\b(cidade|endereco|localizacao|local|cadastrad)\b/.test(responseValue);
}

function extractMenuSubject(message: string) {
  const value = normalizeForIntent(message).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const match = value.match(/(?:preco|valor|quanto custa|quanto e|tem)\s+(?:do|da|de|o|a)?\s*([a-z0-9\s]{3,50})/);
  return match?.[1]?.replace(/\b(no cardapio|cardapio|pra mim|para mim)\b/g, "").trim();
}

function retrievedKnowledgeHasPrice(retrievedKnowledge: RetrievedKnowledge[], subjectWords: string[] = []) {
  return retrievedKnowledge.some((item) => {
    const content = normalizeForIntent(`${item.title ?? ""} ${item.content}`);
    return PRICE_PATTERN.test(item.content) && (!subjectWords.length || subjectWords.some((word) => content.includes(word)));
  });
}

function persistedConversationId(conversationId: string) {
  return conversationId.startsWith("dashboard-test-") ? undefined : conversationId;
}

function preview(value?: string | null, maxLength = 1200) {
  if (!value) return undefined;
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

async function logAIGovernance(input: {
  companyId: string;
  conversationId?: string;
  provider: string;
  model: string;
  promptPreview?: string;
  responsePreview?: string;
  retrievedKnowledge?: RetrievedKnowledge[];
  fallbackUsed?: boolean;
  needsHumanReview?: boolean;
  status: string;
  errorMessage?: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}) {
  try {
    await prisma.aIGovernanceLog.create({
      data: {
        companyId: input.companyId,
        conversationId: input.conversationId,
        provider: input.provider,
        model: input.model,
        promptPreview: input.promptPreview,
        responsePreview: input.responsePreview,
        retrievedKnowledge: input.retrievedKnowledge ? JSON.parse(JSON.stringify(input.retrievedKnowledge)) as Prisma.InputJsonValue : undefined,
        fallbackUsed: input.fallbackUsed ?? false,
        needsHumanReview: input.needsHumanReview ?? false,
        status: input.status,
        errorMessage: input.errorMessage,
        latencyMs: input.latencyMs,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        totalTokens: input.totalTokens,
      },
    });
  } catch {
    // Governance logs must never interrupt an active customer conversation.
  }
}

function maybeBuildMenuPriceFallback(input: {
  customerMessage: string;
  retrievedKnowledge: RetrievedKnowledge[];
}) {
  const message = normalizeForIntent(input.customerMessage);
  const isMenuOrPriceQuestion = /\b(preco|valor|quanto custa|quanto e|cardapio|menu)\b/.test(message);
  if (!isMenuOrPriceQuestion) return null;

  const subject = extractMenuSubject(input.customerMessage);
  const subjectWords = subject?.split(/\s+/).filter((word) => word.length > 3) ?? [];
  const hasRelevantPrice = retrievedKnowledgeHasPrice(input.retrievedKnowledge, subjectWords);
  if (!hasRelevantPrice) return null;

  return SAFE_MENU_PRICE_MESSAGE;
}

function normalizeHumanReviewResponse(content: string, customerMessage: string, companyName: string) {
  if (!content.includes(HUMAN_REVIEW_MARKER)) {
    return { content, needsHumanReview: false };
  }

  const category = classifyMessageNeedHumanReview(customerMessage);
  if (!shouldForceHumanReview(category)) {
    return {
      content: buildNonBlockingFallback(customerMessage),
      needsHumanReview: false,
    };
  }

  if (shouldKeepAiForClarification(customerMessage)) {
    return {
      content: buildClarificationResponse(customerMessage, companyName),
      needsHumanReview: false,
    };
  }

  const cleaned = content.replace(HUMAN_REVIEW_MARKER, "").trim();
  return {
    content: cleaned || SAFE_HUMAN_REVIEW_MESSAGE,
    needsHumanReview: true,
  };
}

export type HumanReviewCategory =
  | "NORMAL"
  | "PRICE_NEGOTIATION"
  | "LEGAL"
  | "COMPLAINT"
  | "CANCELLATION"
  | "FINANCIAL_PROBLEM"
  | "SENSITIVE_DATA"
  | "HUMAN_REQUESTED"
  | "UNKNOWN_INFORMATION";

export function classifyMessageNeedHumanReview(message: string): HumanReviewCategory {
  const value = normalizeForIntent(message);
  if (/humano|atendente|pessoa|gerente/.test(value)) return "HUMAN_REQUESTED";
  if (/processo|procon|advogado|juridico/.test(value)) return "LEGAL";
  if (/reclama|comida.*errad|pedido.*errad|veio.*errad|demora|irritad|mal estar|vencid|estragad/.test(value)) return "COMPLAINT";
  if (/cancelar|cancelamento|desistir/.test(value)) return "CANCELLATION";
  if (/desconto|negociar|abaixar|cobrir oferta/.test(value)) return "PRICE_NEGOTIATION";
  if (/boleto atrasado|divida|inadimplente|financeiro/.test(value)) return "FINANCIAL_PROBLEM";
  if (/cpf|rg|senha|cvv|cvc|validade do cartao|numero do cartao|dados do cartao|codigo de seguranca|codigo sms|codigo de verificacao/.test(value)) return "SENSITIVE_DATA";
  if (/nao sei|duvida complexa|informacao oficial/.test(value)) return "UNKNOWN_INFORMATION";
  return "NORMAL";
}

export function shouldForceHumanReview(category: HumanReviewCategory) {
  return [
    "HUMAN_REQUESTED",
    "LEGAL",
    "COMPLAINT",
    "CANCELLATION",
    "SENSITIVE_DATA",
  ].includes(category);
}

export async function generateAssistantResponse(input: {
  company: Company;
  assistant: Assistant;
  conversation: Conversation;
  customerMessage: string;
  history: Message[];
  retrievedKnowledge: RetrievedKnowledge[];
  companyKnowledgeContext: CompanyAIKnowledgeContext;
}) {
  const config = await resolveAIConfig(input.company);
  const conversationId = persistedConversationId(input.conversation.id);
  if (!config.apiKey) {
    const content = normalizePortugueseAccents(
      input.assistant.fallbackMessage ??
      `Ainda nao ha chave ${config.providerName === "openrouter" ? "OpenRouter" : "OpenAI"} configurada. Um atendente humano pode assumir esta conversa para responder manualmente.`,
    );
    await logAIGovernance({
      companyId: input.company.id,
      conversationId,
      provider: config.providerName,
      model: config.model,
      responsePreview: preview(content),
      retrievedKnowledge: input.retrievedKnowledge,
      fallbackUsed: true,
      needsHumanReview: true,
      status: "fallback_no_key",
    });
    return {
      content,
      generated: false,
      needsHumanReview: true,
    };
  }

  const menuPriceFallback = maybeBuildMenuPriceFallback({
    customerMessage: input.customerMessage,
    retrievedKnowledge: input.retrievedKnowledge,
  });
  if (menuPriceFallback) {
    await logAIGovernance({
      companyId: input.company.id,
      conversationId,
      provider: config.providerName,
      model: config.model,
      responsePreview: preview(menuPriceFallback),
      retrievedKnowledge: input.retrievedKnowledge,
      fallbackUsed: true,
      needsHumanReview: true,
      status: "fallback_price_guardrail",
    });
    return { content: menuPriceFallback, generated: false, needsHumanReview: true };
  }

  const prompt = buildWhatsAppAttendantPrompt({
    company: input.company,
    assistant: input.assistant,
    conversationSummary: input.conversation.aiSummary,
    customerMessage: input.customerMessage,
    history: input.history,
    retrievedKnowledge: input.retrievedKnowledge,
    companyKnowledgeContext: input.companyKnowledgeContext,
  });

  const startedAt = Date.now();
  try {
    const result = await config.provider.generateResponse({
      apiKey: config.apiKey,
      model: config.model,
      prompt: prompt.prompt,
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      temperature: input.assistant.temperature,
      maxTokens: input.assistant.maxTokens,
    });
    const estimatedCost = config.providerName === "openai" ? estimateOpenAICost(result.model, result.inputTokens, result.outputTokens) : 0;
    await logAIUsage({
      companyId: input.company.id,
      conversationId,
      provider: config.providerName,
      model: result.model,
      embeddingModel: config.embeddingModel,
      usedCompanyKey: config.usedCompanyKey,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      totalTokens: result.totalTokens,
      estimatedCost,
      requestType: "response",
      status: "success",
    });
    const normalized = normalizeHumanReviewResponse(result.content, input.customerMessage, input.company.name);
    const content = shouldUseLocationClarification(input.customerMessage, normalized.content)
      ? buildClarificationResponse(input.customerMessage, input.company.name)
      : normalized.content;
    if (PRICE_PATTERN.test(content) && retrievedKnowledgeHasPrice(input.retrievedKnowledge)) {
      await logAIGovernance({
        companyId: input.company.id,
        conversationId,
        provider: config.providerName,
        model: result.model,
        promptPreview: preview(prompt.prompt),
        responsePreview: preview(SAFE_MENU_PRICE_MESSAGE),
        retrievedKnowledge: input.retrievedKnowledge,
        fallbackUsed: true,
        needsHumanReview: true,
        status: "fallback_price_guardrail",
        latencyMs: Date.now() - startedAt,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.totalTokens,
      });
      return { content: SAFE_MENU_PRICE_MESSAGE, generated: true, needsHumanReview: true };
    }
    await logAIGovernance({
      companyId: input.company.id,
      conversationId,
      provider: config.providerName,
      model: result.model,
      promptPreview: preview(prompt.prompt),
      responsePreview: preview(content),
      retrievedKnowledge: input.retrievedKnowledge,
      needsHumanReview: normalized.needsHumanReview,
      status: "success",
      latencyMs: Date.now() - startedAt,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      totalTokens: result.totalTokens,
    });
    return { content: normalizePortugueseAccents(content), generated: true, needsHumanReview: normalized.needsHumanReview };
  } catch (error) {
    await logAIUsage({
      companyId: input.company.id,
      conversationId,
      provider: config.providerName,
      model: config.model,
      embeddingModel: config.embeddingModel,
      usedCompanyKey: config.usedCompanyKey,
      requestType: "response",
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Erro desconhecido",
    });
    await logAIGovernance({
      companyId: input.company.id,
      conversationId,
      provider: config.providerName,
      model: config.model,
      promptPreview: preview(prompt.prompt),
      retrievedKnowledge: input.retrievedKnowledge,
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Erro desconhecido",
      latencyMs: Date.now() - startedAt,
    });
    throw error;
  }
}
