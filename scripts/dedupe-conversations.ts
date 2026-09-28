import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function refreshConversation(conversationId: string) {
  const latestMessage = await prisma.message.findFirst({ where: { conversationId }, orderBy: { createdAt: "desc" } });
  const unreadCount = await prisma.message.count({ where: { conversationId, senderType: "CUSTOMER", status: "received" } });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessage: latestMessage?.content ?? null, lastMessageAt: latestMessage?.createdAt ?? null, unreadCount },
  });
}

async function mergeGroup(companyId: string, customerPhone: string) {
  const conversations = await prisma.conversation.findMany({
    where: { companyId, customerPhone },
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
  });
  if (conversations.length <= 1) return false;

  const [primary, ...duplicates] = conversations;
  const duplicateIds = duplicates.map((conversation) => conversation.id);

  for (const duplicateId of duplicateIds) {
    const states = await prisma.conversationModuleState.findMany({ where: { conversationId: duplicateId } }).catch(() => []);
    for (const state of states) {
      const existing = await prisma.conversationModuleState.findUnique({
        where: { conversationId_moduleKey: { conversationId: primary.id, moduleKey: state.moduleKey } },
      }).catch(() => null);
      if (existing) await prisma.conversationModuleState.delete({ where: { id: state.id } });
      else await prisma.conversationModuleState.update({ where: { id: state.id }, data: { conversationId: primary.id } });
    }
  }

  await prisma.message.updateMany({ where: { conversationId: { in: duplicateIds } }, data: { conversationId: primary.id } });
  await prisma.aIUsageLog.updateMany({ where: { conversationId: { in: duplicateIds } }, data: { conversationId: primary.id } });
  await prisma.messageDeliveryAttempt.updateMany({ where: { conversationId: { in: duplicateIds } }, data: { conversationId: primary.id } });
  await prisma.restaurantOrder.updateMany({ where: { conversationId: { in: duplicateIds } }, data: { conversationId: primary.id } }).catch(() => undefined);
  await prisma.conversation.deleteMany({ where: { id: { in: duplicateIds } } });
  await refreshConversation(primary.id);
  console.log(`merged ${duplicateIds.length} duplicate conversation(s) for ${companyId}/${customerPhone} into ${primary.id}`);
  return true;
}

async function main() {
  const groups = await prisma.conversation.groupBy({
    by: ["companyId", "customerPhone"],
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  });

  let mergedGroups = 0;
  for (const group of groups) {
    if (await mergeGroup(group.companyId, group.customerPhone)) mergedGroups += 1;
  }
  console.log(`dedupe complete. duplicate groups merged: ${mergedGroups}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
