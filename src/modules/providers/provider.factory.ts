import { env } from "@/lib/env";
import type { MessageProvider } from "./message-provider";
import { MockProvider } from "./mock-provider";
import { WhatsAppCloudProvider } from "./whatsapp-cloud.provider";
import { WhatsAppQrProvider } from "./whatsapp-qr.provider";

export function getMessageProvider(): MessageProvider {
  if (env.MESSAGE_PROVIDER === "whatsapp-cloud") return new WhatsAppCloudProvider();
  if (env.MESSAGE_PROVIDER === "whatsapp-qr") return new WhatsAppQrProvider();
  return new MockProvider();
}
