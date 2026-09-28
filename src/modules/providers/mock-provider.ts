import type { MessageProvider } from "./message-provider";
export class MockProvider implements MessageProvider {
  async sendMessage(): Promise<string | undefined> {
    return undefined;
  }

  async receiveMessage(payload: unknown): Promise<void> {
    const { handleIncomingMessage } = await import("@/services/message-orchestrator.service");
    const input = payload as {
      companyId?: string;
      companyWhatsappNumber?: string;
      from: string;
      customerName?: string;
      message: string;
    };
    await handleIncomingMessage(input);
  }
}
