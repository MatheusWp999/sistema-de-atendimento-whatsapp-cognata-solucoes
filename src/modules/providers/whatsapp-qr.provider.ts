import type { MessageProvider } from "./message-provider";
import { whatsappQrSessionManager } from "./whatsapp-qr.service";

export class WhatsAppQrProvider implements MessageProvider {
  async sendMessage(params: {
    companyId: string;
    conversationId: string;
    to: string;
    message: string;
  }): Promise<string | undefined> {
    const externalId = await whatsappQrSessionManager.sendMessage(params.companyId, params.to, params.message);
    if (!externalId) throw new Error("WhatsApp QR nao confirmou o envio da mensagem.");
    return externalId;
  }

  async receiveMessage(): Promise<void> {
    return Promise.resolve();
  }
}
