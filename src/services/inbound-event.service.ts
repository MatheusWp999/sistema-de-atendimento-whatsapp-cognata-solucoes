import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { redactSensitiveContent } from "@/services/privacy.service";

const MAX_INBOUND_ATTEMPTS = 5;
const INBOUND_LEASE_MS = 2 * 60_000;
const workerId = `${process.pid}-${randomUUID()}`;

type QueuedInboundPayload = {
  companyId?: string;
  companyWhatsappNumber?: string;
  providerAccountId?: string;
  from: string;
  customerName?: string;
  contactAliases?: string[];
  message: string;
  externalId: string;
};

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function resolveCompanyId(input: { phoneNumberId?: string; displayPhoneNumber?: string }) {
  const company = await prisma.company.findFirst({
    where: input.phoneNumberId
      ? { whatsappPhoneNumberId: input.phoneNumberId }
      : input.displayPhoneNumber
        ? { whatsappNumber: input.displayPhoneNumber }
        : { id: "__missing__" },
    select: { id: true },
  });
  return company?.id;
}

export async function enqueueInboundMessage(provider: string, payload: QueuedInboundPayload) {
  const safePayload = { ...payload, message: redactSensitiveContent(payload.message) };
  return prisma.inboundEvent.upsert({
    where: { provider_externalId: { provider, externalId: safePayload.externalId } },
    create: {
      provider,
      providerAccountId: safePayload.providerAccountId,
      externalId: safePayload.externalId,
      companyId: safePayload.companyId,
      payload: toJson(safePayload),
      status: "queued",
    },
    update: {},
  });
}

export async function enqueueWhatsAppCloudInboundEvents(payload: unknown) {
  const body = payload as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          metadata?: { display_phone_number?: string; phone_number_id?: string };
          contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
          messages?: Array<{ id?: string; from?: string; text?: { body?: string }; timestamp?: string }>;
        };
      }>;
    }>;
  };

  let queued = 0;
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      const displayPhoneNumber = value?.metadata?.display_phone_number;
      const companyId = await resolveCompanyId({ phoneNumberId, displayPhoneNumber });
      for (const message of value?.messages ?? []) {
        if (!message.id || !message.from || !message.text?.body) continue;
        await enqueueInboundMessage("whatsapp-cloud", {
          companyId,
          companyWhatsappNumber: displayPhoneNumber,
          providerAccountId: phoneNumberId,
          from: message.from,
          customerName: value?.contacts?.find((contact) => contact.wa_id === message.from)?.profile?.name ?? value?.contacts?.[0]?.profile?.name,
          message: message.text.body,
          externalId: message.id,
        });
        queued += 1;
      }
    }
  }
  return { queued };
}

async function processInboundEvent(eventId: string) {
  const event = await prisma.inboundEvent.findUnique({ where: { id: eventId } });
  if (!event) return { eventId, status: "missing" };
  const payload = event.payload as QueuedInboundPayload;
  const { handleIncomingMessage } = await import("@/services/message-orchestrator.service");
  await handleIncomingMessage({
    companyId: payload.companyId,
    companyWhatsappNumber: payload.companyWhatsappNumber,
    from: payload.from,
    customerName: payload.customerName,
    contactAliases: payload.contactAliases,
    message: payload.message,
    externalId: payload.externalId,
  });
  await prisma.inboundEvent.update({ where: { id: eventId }, data: { status: "completed", finishedAt: new Date(), errorMessage: null, lockedBy: null, leaseExpiresAt: null } });
  return { eventId, status: "completed" };
}

export async function processPendingInboundEvents(options?: { limit?: number }) {
  await prisma.inboundEvent.updateMany({
    where: { status: "processing", leaseExpiresAt: { lt: new Date() }, attempts: { lt: MAX_INBOUND_ATTEMPTS } },
    data: { status: "failed_retryable", lockedBy: null, leaseExpiresAt: null },
  });

  const events = await prisma.inboundEvent.findMany({
    where: { status: { in: ["queued", "failed_retryable"] }, attempts: { lt: MAX_INBOUND_ATTEMPTS } },
    orderBy: { receivedAt: "asc" },
    take: options?.limit ?? 20,
  });

  const results = [];
  for (const event of events) {
    const claim = await prisma.inboundEvent.updateMany({
      where: { id: event.id, status: { in: ["queued", "failed_retryable"] } },
      data: { status: "processing", attempts: { increment: 1 }, lockedBy: workerId, leaseExpiresAt: new Date(Date.now() + INBOUND_LEASE_MS), startedAt: new Date() },
    });
    if (!claim.count) continue;
    try {
      results.push(await processInboundEvent(event.id));
    } catch (error) {
      const attempts = event.attempts + 1;
      const final = attempts >= MAX_INBOUND_ATTEMPTS;
      await prisma.inboundEvent.update({
        where: { id: event.id },
        data: {
          status: final ? "failed_final" : "failed_retryable",
          errorMessage: error instanceof Error ? error.message : "Erro desconhecido ao processar inbound",
          lockedBy: null,
          leaseExpiresAt: null,
          finishedAt: new Date(),
        },
      });
      results.push({ eventId: event.id, status: final ? "failed_final" : "failed_retryable" });
    }
  }
  return results;
}
