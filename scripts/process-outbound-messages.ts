import { processPendingOutboundMessages } from "@/services/outbound-message.service";
import { prisma } from "@/lib/db";

const once = process.argv.includes("--once");
const intervalMs = Number(process.env.OUTBOUND_WORKER_INTERVAL_MS ?? 5000);
const limit = Number(process.env.OUTBOUND_WORKER_BATCH_SIZE ?? 20);

async function tick() {
  const results = await processPendingOutboundMessages({ limit });
  if (results.length) {
    console.log(JSON.stringify({ at: new Date().toISOString(), processed: results.length, results }));
  }
}

async function main() {
  if (once) {
    await tick();
    return;
  }

  console.log(`Outbound worker iniciado. Intervalo=${intervalMs}ms, lote=${limit}.`);
  for (;;) {
    await tick().catch((error) => {
      console.error("Erro no outbound worker", error instanceof Error ? error.message : error);
    });
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    if (once) await prisma.$disconnect();
  });
