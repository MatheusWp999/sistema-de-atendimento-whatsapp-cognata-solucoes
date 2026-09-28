import { prisma } from "@/lib/db";
import type { CompanyAIKnowledgeContext } from "@/types";

export const ALWAYS_ON_PERSONA_TYPES = ["Identidade e persona da IA"];
export const ALWAYS_ON_RULE_TYPES = ["Regras de atendimento", "Politica interna", "Informacao juridica"];
export const ALWAYS_ON_TRAINING_TYPES = ["Treinamento", "Script comercial", "Objecoes e respostas"];
export const ALWAYS_ON_COMPANY_PROFILE_TYPES = ["Informacoes da empresa", "Atividades da empresa"];

export const ALWAYS_ON_KNOWLEDGE_TYPES = [
  ...ALWAYS_ON_PERSONA_TYPES,
  ...ALWAYS_ON_RULE_TYPES,
  ...ALWAYS_ON_TRAINING_TYPES,
  ...ALWAYS_ON_COMPANY_PROFILE_TYPES,
];

const ALWAYS_ON_BRIEFING_KEYWORDS = ["briefing", "persona", "atendimento", "contexto", "quem somos", "tom de voz", "posicionamento"];
const CONTEXT_CACHE_TTL_MS = 60_000;
const contextCache = new Map<string, { expiresAt: number; value: CompanyAIKnowledgeContext }>();

type GeneralBusinessHours = {
  businessType?: string;
  descriptionTitle?: string;
  alwaysOpen?: boolean;
  continueAfterHours?: boolean;
};

function limitText(value: string, maxChars: number) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n[conteudo truncado para preservar tokens]`;
}

function parseBusinessHours(value: unknown): GeneralBusinessHours {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as GeneralBusinessHours;
}

async function getRegisteredCompanyProfile(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, description: true, notes: true, businessHours: true },
  });
  if (!company) return "";

  const businessHours = parseBusinessHours(company.businessHours);
  return [
    "DADOS CADASTRAIS DA EMPRESA",
    `Nome da empresa: ${company.name}`,
    company.notes || businessHours.businessType ? `Tipo de empresa: ${businessHours.businessType || company.notes}` : undefined,
    businessHours.descriptionTitle ? `Titulo da descricao: ${businessHours.descriptionTitle}` : undefined,
    company.description ? `Descricao da empresa: ${company.description}` : undefined,
    typeof businessHours.alwaysOpen === "boolean" ? `Funcionamento 24h: ${businessHours.alwaysOpen ? "sim" : "nao"}` : undefined,
    typeof businessHours.continueAfterHours === "boolean"
      ? `Fora do horario de atendimento: ${businessHours.continueAfterHours ? "continuar atendendo normalmente" : "informar apenas que a empresa esta fechada"}`
      : undefined,
  ].filter(Boolean).join("\n");
}

async function getItemsByTypes(companyId: string, types: string[], maxChars: number) {
  const items = await prisma.knowledgeItem.findMany({
    where: {
      companyId,
      active: true,
      type: { in: types },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      chunks: {
        orderBy: { chunkIndex: "asc" },
        take: 8,
      },
    },
    take: 12,
  });

  const text = items
    .map((item) => {
      const content = item.chunks.length ? item.chunks.map((chunk) => chunk.content).join("\n") : item.content;
      if (!content?.trim()) return "";
      return `TITULO: ${item.title}\nTIPO: ${item.type}\nCONTEUDO:\n${content.trim()}`;
    })
    .filter(Boolean)
    .join("\n\n---\n\n");

  return limitText(text || "Nenhum conteudo ativo cadastrado nesta camada.", maxChars);
}

async function getCompanyProfileItems(companyId: string, maxChars: number) {
  const items = await prisma.knowledgeItem.findMany({
    where: {
      companyId,
      active: true,
      OR: [
        { type: { in: ALWAYS_ON_COMPANY_PROFILE_TYPES } },
        ...ALWAYS_ON_BRIEFING_KEYWORDS.map((keyword) => ({ title: { contains: keyword, mode: "insensitive" as const } })),
        ...ALWAYS_ON_BRIEFING_KEYWORDS.map((keyword) => ({ content: { contains: keyword, mode: "insensitive" as const } })),
      ],
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      chunks: {
        orderBy: { chunkIndex: "asc" },
        take: 8,
      },
    },
    take: 12,
  });

  const text = items
    .map((item) => {
      const content = item.chunks.length ? item.chunks.map((chunk) => chunk.content).join("\n") : item.content;
      if (!content?.trim()) return "";
      return `TITULO: ${item.title}\nTIPO: ${item.type}\nCONTEUDO:\n${content.trim()}`;
    })
    .filter(Boolean)
    .join("\n\n---\n\n");

  return limitText(text || "Nenhum conteudo ativo cadastrado nesta camada.", maxChars);
}

export async function getCompanyAIKnowledgeContext(companyId: string): Promise<CompanyAIKnowledgeContext> {
  const cached = contextCache.get(companyId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const [persona, rules, trainings, registeredCompanyProfile, companyProfile] = await Promise.all([
    getItemsByTypes(companyId, ALWAYS_ON_PERSONA_TYPES, 5000),
    getItemsByTypes(companyId, ALWAYS_ON_RULE_TYPES, 7000),
    getItemsByTypes(companyId, ALWAYS_ON_TRAINING_TYPES, 9000),
    getRegisteredCompanyProfile(companyId),
    getCompanyProfileItems(companyId, 12000),
  ]);

  const mergedCompanyProfile = limitText([registeredCompanyProfile, companyProfile].filter(Boolean).join("\n\n---\n\n"), 14000);
  const value = { persona, rules, trainings, companyProfile: mergedCompanyProfile };
  contextCache.set(companyId, { expiresAt: Date.now() + CONTEXT_CACHE_TTL_MS, value });
  return value;
}

export function clearCompanyAIKnowledgeContextCache(companyId?: string) {
  if (companyId) contextCache.delete(companyId);
  else contextCache.clear();
}
