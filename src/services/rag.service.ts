import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveOpenAIConfig } from "@/modules/ai/ai-provider.factory";
import type { RetrievedKnowledge } from "@/types";
import { ALWAYS_ON_KNOWLEDGE_TYPES, clearCompanyAIKnowledgeContextCache } from "@/services/knowledge-context.service";

const RAG_CACHE_TTL_MS = 30_000;
const MAX_VECTOR_DISTANCE = 0.45;
const ragCache = new Map<string, { expiresAt: number; value: RetrievedKnowledge[] }>();
const OPERATIONAL_SHORT_MESSAGES = new Set(["sim", "pode", "ok", "certo", "isso", "isso mesmo", "delivery", "entrega", "retirada", "pix", "dinheiro", "cartao", "cartão", "nao", "não"]);

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function questionTerms(question: string) {
  const terms = normalizeSearchText(question)
    .split(/\s+/)
    .filter((term) => term.length > 3)
    .slice(0, 8);

  if (/\b(cardapio|menu|opcoes|opcao|pratos|comidas|bebidas)\b/.test(normalizeSearchText(question))) {
    terms.unshift("cardapio");
  }

  return Array.from(new Set(terms));
}

export function chunkText(text: string, maxChars = 1800) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const chunks: string[] = [];
  for (let index = 0; index < normalized.length; index += maxChars) {
    chunks.push(normalized.slice(index, index + maxChars));
  }
  return chunks.filter(Boolean);
}

function toVectorLiteral(embedding: number[]) {
  return `[${embedding.join(",")}]`;
}

function isValidEmbedding(embedding: unknown): embedding is number[] {
  return Array.isArray(embedding) && embedding.length > 0 && embedding.every((value) => typeof value === "number" && Number.isFinite(value));
}

function fallbackTextSearch(params: { companyId: string; question: string; limit?: number }): Promise<RetrievedKnowledge[]> {
  const terms = questionTerms(params.question);
  return prisma.knowledgeChunk
    .findMany({
      where: {
        companyId: params.companyId,
        knowledgeItem: { active: true, type: { notIn: ALWAYS_ON_KNOWLEDGE_TYPES } },
        ...(terms.length
          ? {
            OR: terms.flatMap((term) => [
              { content: { contains: term, mode: "insensitive" as const } },
              { knowledgeItem: { title: { contains: term, mode: "insensitive" as const } } },
            ]),
          }
          : {}),
      },
      take: 80,
      include: { knowledgeItem: true },
    })
    .then((chunks) =>
      chunks
        .map((chunk) => {
          const title = normalizeSearchText(chunk.knowledgeItem.title);
          const searchable = normalizeSearchText(`${chunk.knowledgeItem.title} ${chunk.content}`);
          const score = terms.reduce((total, term) => {
            const singular = term.endsWith("s") ? term.slice(0, -1) : term;
            const plural = term.endsWith("s") ? term : `${term}s`;
            return total +
              (title === term ? 30 : 0) +
              (title.includes(term) ? 18 : 0) +
              (searchable.includes(term) ? 4 : 0) +
              (searchable.includes(singular) ? 2 : 0) +
              (searchable.includes(plural) ? 2 : 0);
          }, 0);
          return { chunk, score };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || a.chunk.chunkIndex - b.chunk.chunkIndex)
        .slice(0, params.limit ?? 5)
        .map(({ chunk }) => ({
          content: chunk.content,
          title: chunk.knowledgeItem.title,
          knowledgeItemId: chunk.knowledgeItemId,
        })),
    );
}

function mergeKnowledgeResults(...groups: RetrievedKnowledge[][]) {
  const seen = new Set<string>();
  return groups.flat().filter((item) => {
    const key = `${item.knowledgeItemId}:${item.content}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function searchCompanyKnowledge(params: {
  companyId: string;
  question: string;
  limit?: number;
}): Promise<RetrievedKnowledge[]> {
  const normalizedQuestion = normalizeSearchText(params.question);
  if (normalizedQuestion.length <= 3 || OPERATIONAL_SHORT_MESSAGES.has(normalizedQuestion)) return [];

  const cacheKey = `${params.companyId}:${params.limit ?? 5}:${normalizedQuestion}`;
  const cached = ragCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const company = await prisma.company.findUnique({ where: { id: params.companyId } });
  if (!company) return [];

  const config = await resolveOpenAIConfig(company);
  if (!config.apiKey) {
    const value = await fallbackTextSearch(params);
    ragCache.set(cacheKey, { expiresAt: Date.now() + RAG_CACHE_TTL_MS, value });
    return value;
  }

  const textMatches = await fallbackTextSearch(params);

  const embedding = await config.provider.generateEmbedding({
    apiKey: config.apiKey,
    model: config.embeddingModel,
    input: params.question,
  }).catch(() => []);

  if (!isValidEmbedding(embedding)) {
    ragCache.set(cacheKey, { expiresAt: Date.now() + RAG_CACHE_TTL_MS, value: textMatches });
    return textMatches;
  }

  const vector = toVectorLiteral(embedding);
  const rows = await prisma.$queryRaw<RetrievedKnowledge[]>(Prisma.sql`
     SELECT kc.content, ki.title, kc."knowledgeItemId", (kc.embedding <=> ${vector}::vector) AS score
     FROM "KnowledgeChunk" kc
     INNER JOIN "KnowledgeItem" ki ON ki.id = kc."knowledgeItemId"
     WHERE kc."companyId" = ${params.companyId}
       AND ki.active = true
       AND ki.type NOT IN (${Prisma.join(ALWAYS_ON_KNOWLEDGE_TYPES)})
       AND kc.embedding IS NOT NULL
       AND (kc.embedding <=> ${vector}::vector) <= ${MAX_VECTOR_DISTANCE}
     ORDER BY kc.embedding <=> ${vector}::vector
     LIMIT ${params.limit ?? 5}`);

  const value = mergeKnowledgeResults(textMatches, rows).slice(0, params.limit ?? 5);
  ragCache.set(cacheKey, { expiresAt: Date.now() + RAG_CACHE_TTL_MS, value });
  return value;
}

export function clearRagCache() {
  ragCache.clear();
}

export async function processKnowledgeItem(knowledgeItemId: string) {
  const item = await prisma.knowledgeItem.findUnique({ where: { id: knowledgeItemId }, include: { company: true } });
  if (!item) return null;
  clearRagCache();
  clearCompanyAIKnowledgeContextCache(item.companyId);

  await prisma.knowledgeChunk.deleteMany({ where: { knowledgeItemId } });
  if (!item.content?.trim()) {
    return prisma.knowledgeItem.update({
      where: { id: knowledgeItemId },
      data: { processed: false },
    });
  }

  const chunks = chunkText(item.content);
  const config = await resolveOpenAIConfig(item.company);
  let attemptedEmbeddings = false;
  let storedEmbeddings = 0;

  for (const [index, content] of chunks.entries()) {
    const chunk = await prisma.knowledgeChunk.create({
      data: {
        companyId: item.companyId,
        knowledgeItemId,
        content,
        chunkIndex: index,
        tokenCount: Math.ceil(content.length / 4),
      },
    });

    if (config.apiKey) {
      attemptedEmbeddings = true;
      const embedding = await config.provider.generateEmbedding({
        apiKey: config.apiKey,
        model: config.embeddingModel,
        input: content,
      }).catch(() => []);
      if (isValidEmbedding(embedding)) {
        const vector = toVectorLiteral(embedding);
        const stored = await prisma.$executeRaw`UPDATE "KnowledgeChunk" SET embedding = ${vector}::vector WHERE id = ${chunk.id}`.then(() => true).catch(() => false);
        if (stored) storedEmbeddings += 1;
      }
    }
  }

  return prisma.knowledgeItem.update({
    where: { id: knowledgeItemId },
    data: { processed: !attemptedEmbeddings || storedEmbeddings > 0 },
  });
}
