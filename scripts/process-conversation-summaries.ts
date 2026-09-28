import { processPendingConversationSummaries } from "@/services/conversation-summary.service";
import { prisma } from "@/lib/db";

const once = process.argv.includes("--once");
const intervalMs = Number(process.env.SUMMARY_WORKER_INTERVAL_MS ?? 10000);
const limit = Number(process.env.SUMMARY_WORKER_BATCH_SIZE ?? 10);

async function tick() {
  const results = await processPendingConversationSummaries({ limit });
  if (results.length) console.log(JSON.stringify({ at: new Date().toISOString(), processed: results.length, results }));
}

async function main() {
  if (once) {
    await tick();
    return;
  }

  console.log(`Summary worker iniciado. Intervalo=${intervalMs}ms, lote=${limit}.`);
  for (;;) {
    await tick().catch((error) => console.error("Erro no summary worker", error instanceof Error ? error.message : error));
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
