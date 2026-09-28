import type { Conversation, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ConversationAIStatus, ConversationOwner } from "@/lib/constants";

type ResolveConversationInput = {
  companyId: string;
  customerPhone: string;
  aliases?: Array<string | undefined | null>;
  customerName?: string;
  defaults?: Partial<Pick<Conversation, "aiStatus" | "currentOwner" | "lastMessage" | "lastMessageAt">>;
};

function compactUnique(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export function normalizeConversationPhone(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/@c\.us$/i, "")
    .replace(/^whatsapp:/i, "");
}

export function buildConversationAliases(customerPhone: string, aliases: Array<string | undefined | null> = []) {
  return compactUnique([customerPhone, ...aliases].map((value) => value ? normalizeConversationPhone(value) : undefined));
}

function conversationTime(conversation: Pick<Conversation, "lastMessageAt" | "updatedAt" | "createdAt">) {
  return (conversation.lastMessageAt ?? conversation.updatedAt ?? conversation.createdAt).getTime();
}

async function refreshConversationSnapshot(conversationId: string) {
  const latestMessage = await prisma.message.findFirst({ where: { conversationId }, orderBy: { createdAt: "desc" } });
  const unreadCount = await prisma.message.count({ where: { conversationId, senderType: "CUSTOMER", status: "received" } });
  return prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessage: latestMessage?.content ?? null,
      lastMessageAt: latestMessage?.createdAt ?? null,
      unreadCount,
    },
  });
}

export async function mergeDuplicateConversations(primaryId: string, duplicateIds: string[]) {
  const ids = Array.from(new Set(duplicateIds.filter((id) => id && id !== primaryId)));
  if (!ids.length) return prisma.conversation.findUniqueOrThrow({ where: { id: primaryId } });

  for (const duplicateId of ids) {
    const duplicateStates = await prisma.conversationModuleState.findMany({ where: { conversationId: duplicateId } });
    for (const state of duplicateStates) {
      const existingState = await prisma.conversationModuleState.findUnique({
        where: { conversationId_moduleKey: { conversationId: primaryId, moduleKey: state.moduleKey } },
      });
      if (existingState) await prisma.conversationModuleState.delete({ where: { id: state.id } });
      else await prisma.conversationModuleState.update({ where: { id: state.id }, data: { conversationId: primaryId } });
    }
  }

  await prisma.message.updateMany({ where: { conversationId: { in: ids } }, data: { conversationId: primaryId } });
  await prisma.aIUsageLog.updateMany({ where: { conversationId: { in: ids } }, data: { conversationId: primaryId } });
  await prisma.messageDeliveryAttempt.updateMany({ where: { conversationId: { in: ids } }, data: { conversationId: primaryId } });
  await prisma.restaurantOrder.updateMany({ where: { conversationId: { in: ids } }, data: { conversationId: primaryId } });
  await prisma.conversationContactAlias.updateMany({ where: { conversationId: { in: ids } }, data: { conversationId: primaryId } });
  await prisma.conversation.deleteMany({ where: { id: { in: ids } } });

  return refreshConversationSnapshot(primaryId);
}

async function ensureConversationAliases(companyId: string, conversationId: string, aliases: string[]) {
  for (const alias of aliases) {
    const aliasRecord = await prisma.conversationContactAlias.upsert({
      where: { companyId_alias: { companyId, alias } },
      create: { companyId, conversationId, alias },
      update: { alias },
    });
    if (aliasRecord.conversationId !== conversationId) {
      await mergeDuplicateConversations(conversationId, [aliasRecord.conversationId]);
      await prisma.conversationContactAlias.update({ where: { id: aliasRecord.id }, data: { conversationId } });
    }
  }
}

function choosePrimaryConversation(conversations: Conversation[], canonicalPhone: string) {
  return [...conversations].sort((a, b) => {
    if (a.customerPhone === canonicalPhone && b.customerPhone !== canonicalPhone) return -1;
    if (b.customerPhone === canonicalPhone && a.customerPhone !== canonicalPhone) return 1;
    return conversationTime(b) - conversationTime(a);
  })[0];
}

export async function resolveConversationForCustomer(input: ResolveConversationInput) {
  const canonicalPhone = normalizeConversationPhone(input.customerPhone);
  if (!canonicalPhone) throw new Error("Telefone do cliente e obrigatorio para identificar a conversa.");
  const aliases = buildConversationAliases(canonicalPhone, input.aliases);

  const aliasMatches = await prisma.conversationContactAlias.findMany({
    where: { companyId: input.companyId, alias: { in: aliases } },
    include: { conversation: true },
  });
  const directMatches = await prisma.conversation.findMany({ where: { companyId: input.companyId, customerPhone: { in: aliases } } });
  const conversationsById = new Map<string, Conversation>();
  for (const match of aliasMatches) conversationsById.set(match.conversation.id, match.conversation);
  for (const match of directMatches) conversationsById.set(match.id, match);

  if (conversationsById.size) {
    const primary = choosePrimaryConversation(Array.from(conversationsById.values()), canonicalPhone);
    await mergeDuplicateConversations(primary.id, Array.from(conversationsById.keys()).filter((id) => id !== primary.id));

    const data: Prisma.ConversationUpdateInput = {
      ...(input.customerName ? { customerName: input.customerName } : {}),
      ...(input.defaults?.lastMessage ? { lastMessage: input.defaults.lastMessage } : {}),
      ...(input.defaults?.lastMessageAt ? { lastMessageAt: input.defaults.lastMessageAt } : {}),
    };
    if (primary.customerPhone !== canonicalPhone && !directMatches.some((conversation) => conversation.customerPhone === canonicalPhone)) {
      data.customerPhone = canonicalPhone;
    }
    const updated = await prisma.conversation.update({ where: { id: primary.id }, data });
    await ensureConversationAliases(input.companyId, updated.id, aliases);
    return updated;
  }

  const conversation = await prisma.conversation.upsert({
    where: { companyId_customerPhone: { companyId: input.companyId, customerPhone: canonicalPhone } },
    create: {
      companyId: input.companyId,
      customerPhone: canonicalPhone,
      customerName: input.customerName,
      aiStatus: input.defaults?.aiStatus ?? ConversationAIStatus.AI_ACTIVE,
      currentOwner: input.defaults?.currentOwner ?? ConversationOwner.AI,
      lastMessage: input.defaults?.lastMessage,
      lastMessageAt: input.defaults?.lastMessageAt,
    },
    update: {
      ...(input.customerName ? { customerName: input.customerName } : {}),
      ...(input.defaults?.lastMessage ? { lastMessage: input.defaults.lastMessage } : {}),
      ...(input.defaults?.lastMessageAt ? { lastMessageAt: input.defaults.lastMessageAt } : {}),
    },
  });
  await ensureConversationAliases(input.companyId, conversation.id, aliases);
  return conversation;
}
