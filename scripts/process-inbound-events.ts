import { processPendingInboundEvents } from "@/services/inbound-event.service";
import { prisma } from "@/lib/db";

const once = process.argv.includes("--once");
const intervalMs = Number(process.env.INBOUND_WORKER_INTERVAL_MS ?? 3000);
const limit = Number(process.env.INBOUND_WORKER_BATCH_SIZE ?? 20);

let stopping = false;

async function tick() {
  const results = await processPendingInboundEvents({ limit });
  if (results.length) console.log(JSON.stringify({ at: new Date().toISOString(), processed: results.length, results }));
}

async function main() {
  if (once) {
    await tick();
    return;
  }
  console.log(`Inbound worker iniciado. Intervalo=${intervalMs}ms, lote=${limit}.`);
  while (!stopping) {
    await tick().catch((error) => console.error("Erro no inbound worker", error instanceof Error ? error.message : error));
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

async function shutdown() {
  stopping = true;
  await prisma.$disconnect();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
