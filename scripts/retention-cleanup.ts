import { prisma } from "@/lib/db";

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

const messageRetentionDays = Number(process.env.MESSAGE_RETENTION_DAYS ?? 365);
const inboundEventRetentionDays = Number(process.env.INBOUND_EVENT_RETENTION_DAYS ?? 90);
const auditRetentionDays = Number(process.env.AUDIT_LOG_RETENTION_DAYS ?? 730);

async function main() {
  const messageCutoff = daysAgo(messageRetentionDays);
  const inboundCutoff = daysAgo(inboundEventRetentionDays);
  const auditCutoff = daysAgo(auditRetentionDays);

  const [attempts, messages, inboundEvents, sessionCommands, auditLogs] = await prisma.$transaction([
    prisma.messageDeliveryAttempt.deleteMany({ where: { message: { createdAt: { lt: messageCutoff } } } }),
    prisma.message.deleteMany({ where: { createdAt: { lt: messageCutoff } } }),
    prisma.inboundEvent.deleteMany({ where: { createdAt: { lt: inboundCutoff }, status: { in: ["completed", "failed_final"] } } }),
    prisma.whatsAppSessionCommand.deleteMany({ where: { createdAt: { lt: inboundCutoff }, status: { in: ["completed", "failed_final"] } } }),
    prisma.auditLog.deleteMany({ where: { createdAt: { lt: auditCutoff } } }),
  ]);

  console.log(JSON.stringify({
    at: new Date().toISOString(),
    deleted: {
      deliveryAttempts: attempts.count,
      messages: messages.count,
      inboundEvents: inboundEvents.count,
      whatsappSessionCommands: sessionCommands.count,
      auditLogs: auditLogs.count,
    },
  }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
