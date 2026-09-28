import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const conversations = await prisma.conversation.findMany({ select: { id: true } });
  let updated = 0;
  for (const conversation of conversations) {
    const latestCustomerMessage = await prisma.message.findFirst({
      where: { conversationId: conversation.id, senderType: "CUSTOMER" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (!latestCustomerMessage) continue;
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastCustomerMessageAt: latestCustomerMessage.createdAt },
    });
    updated += 1;
  }
  console.log(`lastCustomerMessageAt backfill complete. conversations updated: ${updated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
