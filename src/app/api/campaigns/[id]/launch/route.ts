import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { requireCompanyAccess } from "@/services/api-auth.service";
import { resolveConversationForCustomer } from "@/services/conversation-identity.service";
import { enqueueOutboundMessage } from "@/services/outbound-message.service";
import { SenderType } from "@/lib/constants";

function renderTemplate(body: string, recipient: { phone: string; name: string | null }) {
  return body
    .replace(/{{\s*name\s*}}/gi, recipient.name || "cliente")
    .replace(/{{\s*phone\s*}}/gi, recipient.phone)
    .replace(/{{\s*1\s*}}/g, recipient.name || "cliente");
}

function isValidE164Phone(value: string) {
  return /^\+[1-9]\d{9,14}$/.test(value);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const campaign = await prisma.campaign.findUnique({ where: { id }, include: { template: true, recipients: true } });
    if (!campaign) return apiError(new Error("Campanha nao encontrada."), 404);
    const guard = await requireCompanyAccess(request, campaign.companyId);
    if (guard.response) return guard.response;
    if (!campaign.template) return apiError(new Error("Campanha sem template."), 400);
    if (campaign.template.status !== "APPROVED") return apiError(new Error("Apenas templates aprovados podem ser disparados."), 400);
    const invalidRecipient = campaign.recipients.find((recipient) => !isValidE164Phone(recipient.phone));
    if (invalidRecipient) return apiError(new Error(`Telefone invalido na campanha: ${invalidRecipient.phone}.`), 400);

    await prisma.campaign.update({ where: { id }, data: { status: "RUNNING", startedAt: new Date() } });
    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of campaign.recipients.filter((item) => item.status === "PENDING")) {
      try {
        const conversation = await resolveConversationForCustomer({
          companyId: campaign.companyId,
          customerPhone: recipient.phone,
          customerName: recipient.name ?? undefined,
          defaults: { lastMessageAt: new Date() },
        });
        const content = renderTemplate(campaign.template.body, recipient);
        const message = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            companyId: campaign.companyId,
            senderType: SenderType.HUMAN,
            content,
            origin: "campaign",
            status: "queued",
            metadata: { campaignId: campaign.id, templateId: campaign.template.id, sentContent: content },
          },
        });
        await prisma.campaignRecipient.update({ where: { id: recipient.id }, data: { status: "QUEUED", conversationId: conversation.id, sentAt: new Date() } });
        await enqueueOutboundMessage(message.id, { immediate: true });
        sentCount += 1;
      } catch (error) {
        failedCount += 1;
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: "FAILED", errorMessage: error instanceof Error ? error.message : "Erro desconhecido" },
        });
      }
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data: { status: "COMPLETED", finishedAt: new Date(), sentCount: { increment: sentCount }, failedCount: { increment: failedCount } },
      include: { template: true, _count: { select: { recipients: true } } },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}
