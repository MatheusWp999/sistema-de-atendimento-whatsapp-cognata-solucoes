import { whatsappQrSessionManager } from "@/modules/providers/whatsapp-qr.service";
import { prisma } from "@/lib/db";

const intervalMs = Number(process.env.WHATSAPP_WORKER_HEALTH_INTERVAL_MS ?? 15000);

async function tick() {
  const commands = await whatsappQrSessionManager.processPendingCommands();
  if (commands.length) console.log(JSON.stringify({ at: new Date().toISOString(), commands }));
  await whatsappQrSessionManager.restoreEnabledSessions();
  await whatsappQrSessionManager.refreshAllEnabledSessionsHealth();
  const snapshots = whatsappQrSessionManager.getAllSnapshots();
  if (snapshots.length) console.log(JSON.stringify({ at: new Date().toISOString(), sessions: snapshots }));
}

async function main() {
  console.log(`WhatsApp QR worker iniciado. Intervalo=${intervalMs}ms.`);
  await tick();
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    await tick().catch((error) => console.error("Erro no WhatsApp worker", error instanceof Error ? error.message : error));
  }
}

process.on("SIGINT", async () => {
  await whatsappQrSessionManager.dispose();
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await whatsappQrSessionManager.dispose();
  await prisma.$disconnect();
  process.exit(0);
});

main().catch(async (error) => {
  console.error(error);
  await whatsappQrSessionManager.dispose();
  await prisma.$disconnect();
  process.exit(1);
});
