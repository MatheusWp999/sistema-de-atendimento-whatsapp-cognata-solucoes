import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { processKnowledgeItem } from "@/services/rag.service";
import { requireCompanyAccess } from "@/services/api-auth.service";

function asInt(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(5, Math.max(1, Math.round(parsed)));
}

function buildPersonaKnowledgeContent(input: {
  companyName: string;
  companyDescription?: string | null;
  assistantName: string;
  role?: string | null;
  personality: string;
  tone?: string | null;
  greetingMessage?: string | null;
  closingMessage?: string | null;
  mandatoryRules?: string | null;
  forbiddenRules?: string | null;
  humanEscalationRules?: string | null;
  fallbackMessage?: string | null;
  formalityLevel: number;
  friendlinessLevel: number;
  objectivityLevel: number;
  commercialLevel: number;
  detailLevel: number;
  responseSize: string;
  useEmojis: boolean;
  establishmentContext?: string;
  serviceRoutine?: string;
  idealBehavior?: string;
  neverDo?: string;
  angryClientHandling?: string;
  priceHandling?: string;
  objectionHandling?: string;
  dataCollection?: string;
  humanHandoff?: string;
  goodExamples?: string;
  badExamples?: string;
}) {
  return `PERSONA PERMANENTE DO AGENTE

EMPRESA
Nome: ${input.companyName}
Descricao: ${input.companyDescription || "Nao informada"}
Contexto do estabelecimento: ${input.establishmentContext || "Nao informado"}
Rotina de atendimento/atividades: ${input.serviceRoutine || "Nao informada"}

IDENTIDADE DO ATENDENTE
Nome: ${input.assistantName}
Cargo/função: ${input.role || "Atendente"}
Personalidade principal: ${input.personality}
Tom de voz: ${input.tone || "Natural, profissional e claro"}
Saudacao padrao: ${input.greetingMessage || "Nao informada"}
Encerramento padrao: ${input.closingMessage || "Nao informado"}

PARAMETROS DE COMPORTAMENTO
Formalidade: ${input.formalityLevel}/5
Simpatia: ${input.friendlinessLevel}/5
Objetividade: ${input.objectivityLevel}/5
Intensidade comercial: ${input.commercialLevel}/5
Detalhamento: ${input.detailLevel}/5
Tamanho de resposta: ${input.responseSize}
Uso de emojis: ${input.useEmojis ? "permitido" : "nao permitido"}

COMO O ATENDENTE DEVE AGIR
${input.idealBehavior || "Agir como atendente humano do estabelecimento, com clareza e seguranca."}

REGRAS OBRIGATORIAS
${input.mandatoryRules || "Nao inventar informacoes. Usar apenas dados da empresa atual."}

REGRAS PROIBIDAS / O QUE NUNCA FAZER
${input.forbiddenRules || "Nao prometer condicoes sem base."}
${input.neverDo || ""}

COMO LIDAR COM CLIENTE IRRITADO
${input.angryClientHandling || "Acolher, manter calma, pedir desculpas quando apropriado e encaminhar para humano se necessario."}

COMO LIDAR COM PRECO
${input.priceHandling || "Usar apenas informacoes cadastradas. Se nao souber, encaminhar para humano."}

COMO LIDAR COM OBJECOES
${input.objectionHandling || "Responder com empatia, esclarecer duvidas e nao pressionar o cliente."}

COMO PEDIR DADOS DO CLIENTE
${input.dataCollection || "Pedir somente dados necessarios para continuidade do atendimento."}

QUANDO CHAMAR HUMANO
${input.humanEscalationRules || "Quando faltar informacao, houver tema sensivel ou pedido direto por humano."}
${input.humanHandoff || ""}

MENSAGEM QUANDO NAO SOUBER RESPONDER
${input.fallbackMessage || "Para te passar essa informacao com seguranca, vou encaminhar sua conversa para um atendente responsavel."}

EXEMPLOS DE BOAS RESPOSTAS
${input.goodExamples || "Nao informado"}

EXEMPLOS DE RESPOSTAS PROIBIDAS OU RUINS
${input.badExamples || "Nao informado"}`;
}

function limitedText(value: unknown, max = 8000) {
  return String(value || "").trim().slice(0, max);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const guard = await requireCompanyAccess(request, id);
    if (guard.response) return guard.response;
    const body = await request.json();
    const company = await prisma.company.findUnique({ where: { id }, include: { assistant: true } });
    if (!company) return apiError(new Error("Empresa nao encontrada"), 404);

    const assistantName = limitedText(body.name || company.assistant?.name || "Atendente IA", 80);
    const personality = limitedText(body.personality || company.assistant?.personality || "Atendente profissional, natural e seguro.", 8000);
    const role = limitedText(body.role || company.assistant?.role || "Atendente", 120);

    const assistantData = {
      name: assistantName,
      role,
      personality,
      tone: limitedText(body.tone || "Natural, profissional e claro", 2000),
      greetingMessage: limitedText(body.greetingMessage, 1000) || null,
      closingMessage: limitedText(body.closingMessage, 1000) || null,
      formalityLevel: asInt(body.formalityLevel, company.assistant?.formalityLevel ?? 3),
      friendlinessLevel: asInt(body.friendlinessLevel, company.assistant?.friendlinessLevel ?? 3),
      objectivityLevel: asInt(body.objectivityLevel, company.assistant?.objectivityLevel ?? 3),
      commercialLevel: asInt(body.commercialLevel, company.assistant?.commercialLevel ?? 3),
      detailLevel: asInt(body.detailLevel, company.assistant?.detailLevel ?? 3),
      responseSize: ["curto", "medium", "detalhado"].includes(String(body.responseSize)) ? String(body.responseSize) : company.assistant?.responseSize || "medium",
      useEmojis: Boolean(body.useEmojis),
      temperature: Number(body.temperature ?? company.assistant?.temperature ?? 0.4),
      maxTokens: Number(body.maxTokens ?? company.assistant?.maxTokens ?? 700),
      mandatoryRules: limitedText(body.mandatoryRules, 8000) || null,
      forbiddenRules: limitedText(body.forbiddenRules, 8000) || null,
      humanEscalationRules: limitedText(body.humanEscalationRules, 8000) || null,
      fallbackMessage: limitedText(body.fallbackMessage, 1000) || null,
      enabled: true,
    };

    const assistant = company.assistant
      ? await prisma.assistant.update({ where: { id: company.assistant.id }, data: assistantData })
      : await prisma.assistant.create({ data: { ...assistantData, companyId: id } });

    const content = buildPersonaKnowledgeContent({
      companyName: company.name,
      companyDescription: company.description,
      assistantName: assistant.name,
      role: assistant.role,
      personality: assistant.personality,
      tone: assistant.tone,
      greetingMessage: assistant.greetingMessage,
      closingMessage: assistant.closingMessage,
      mandatoryRules: assistant.mandatoryRules,
      forbiddenRules: assistant.forbiddenRules,
      humanEscalationRules: assistant.humanEscalationRules,
      fallbackMessage: assistant.fallbackMessage,
      formalityLevel: assistant.formalityLevel,
      friendlinessLevel: assistant.friendlinessLevel,
      objectivityLevel: assistant.objectivityLevel,
      commercialLevel: assistant.commercialLevel,
      detailLevel: assistant.detailLevel,
      responseSize: assistant.responseSize,
      useEmojis: assistant.useEmojis,
      establishmentContext: limitedText(body.establishmentContext),
      serviceRoutine: limitedText(body.serviceRoutine),
      idealBehavior: limitedText(body.idealBehavior),
      neverDo: limitedText(body.neverDo),
      angryClientHandling: limitedText(body.angryClientHandling),
      priceHandling: limitedText(body.priceHandling),
      objectionHandling: limitedText(body.objectionHandling),
      dataCollection: limitedText(body.dataCollection),
      humanHandoff: limitedText(body.humanHandoff),
      goodExamples: limitedText(body.goodExamples),
      badExamples: limitedText(body.badExamples),
    });

    const existingPersona = await prisma.knowledgeItem.findFirst({
      where: {
        companyId: id,
        type: "Identidade e persona da IA",
        sourceType: "agent-persona-form",
      },
      orderBy: { updatedAt: "desc" },
    });

    const personaItem = existingPersona
      ? await prisma.knowledgeItem.update({
          where: { id: existingPersona.id },
          data: {
            title: `Persona permanente - ${assistant.name}`,
            content,
            active: true,
            processed: false,
          },
        })
      : await prisma.knowledgeItem.create({
          data: {
            companyId: id,
            title: `Persona permanente - ${assistant.name}`,
            type: "Identidade e persona da IA",
            sourceType: "agent-persona-form",
            content,
            active: true,
          },
        });

    await processKnowledgeItem(personaItem.id);

    return NextResponse.json({ assistant, personaItemId: personaItem.id });
  } catch (error) {
    return apiError(error);
  }
}
