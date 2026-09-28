export interface MessageProvider {
  sendMessage(params: {
    companyId: string;
    conversationId: string;
    to: string;
    message: string;
  }): Promise<string | undefined>;

  receiveMessage(payload: unknown): Promise<void>;
}
