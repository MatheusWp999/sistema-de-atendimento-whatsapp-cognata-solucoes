import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_ENCRYPTION_KEY: z.string().min(32).refine(
    (value) => !["troque-essa-chave-local-com-32-caracteres", "gere-uma-chave-unica-com-pelo-menos-32-caracteres"].includes(value),
    "APP_ENCRYPTION_KEY deve ser unico e nao pode usar o valor padrao.",
  ),
  ADMIN_API_TOKEN: z.string().min(32).optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  DEFAULT_AI_MODEL: z.string().default("gpt-4o-mini"),
  DEFAULT_OPENROUTER_MODEL: z.string().default("meta-llama/llama-3.1-8b-instruct:free"),
  DEFAULT_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  MESSAGE_PROVIDER: z.enum(["mock", "whatsapp-cloud", "whatsapp-qr"]).default("mock"),
  OPERATOR_DISPLAY_NAME: z.string().default("Matheus"),
  OPERATOR_ROLE: z.string().default("RH"),
  ENABLE_DIRECT_AI_RESPOND: z.enum(["true", "false"]).default("false"),
  ENABLE_CHAT_TEST_TOOLS: z.enum(["true", "false"]).default("false"),
  NEXT_PUBLIC_ENABLE_CHAT_TEST_TOOLS: z.enum(["true", "false"]).default("false"),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
});

export const env = envSchema.parse(process.env);
