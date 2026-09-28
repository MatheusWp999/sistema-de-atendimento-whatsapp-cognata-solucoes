import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const conversations = await prisma.conversation.findMany({ select: { id: true, companyId: true, customerPhone: true } });
  let created = 0;
  for (const conversation of conversations) {
    const alias = conversation.customerPhone.trim();
    if (!alias) continue;
    await prisma.conversationContactAlias.upsert({
      where: { companyId_alias: { companyId: conversation.companyId, alias } },
      create: { companyId: conversation.companyId, conversationId: conversation.id, alias },
      update: { conversationId: conversation.id },
    });
    created += 1;
  }
  console.log(`conversation alias backfill complete. aliases ensured: ${created}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
