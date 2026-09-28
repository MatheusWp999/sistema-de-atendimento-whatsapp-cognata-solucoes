import { env } from "@/lib/env";
import type { MessageProvider } from "./message-provider";
import { enqueueWhatsAppCloudInboundEvents } from "@/services/inbound-event.service";

export class WhatsAppCloudProvider implements MessageProvider {
  async sendMessage(params: {
    companyId: string;
    conversationId: string;
    to: string;
    message: string;
  }): Promise<string | undefined> {
    if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
      throw new Error("WhatsApp Cloud sem WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID configurado.");
    }

    const response = await fetch(`https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: params.to,
        type: "text",
        text: { body: params.message },
      }),
    });
    if (!response.ok) throw new Error(`WhatsApp Cloud falhou ao enviar mensagem: ${await response.text()}`);
    const body = await response.json() as { messages?: Array<{ id?: string }> };
    const externalId = body.messages?.[0]?.id;
    if (!externalId) throw new Error("WhatsApp Cloud nao retornou WAMID para a mensagem enviada.");
    return externalId;
  }

  async receiveMessage(payload: unknown): Promise<void> {
    await enqueueWhatsAppCloudInboundEvents(payload);
  }
}
