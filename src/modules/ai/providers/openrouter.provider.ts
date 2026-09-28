import OpenAI from "openai";
import type { AIProvider } from "./ai-provider";
import type {
  GenerateEmbeddingParams,
  GenerateResponseParams,
  GenerateResponseResult,
} from "@/types";

export class OpenRouterProvider implements AIProvider {
  async generateResponse(params: GenerateResponseParams): Promise<GenerateResponseResult> {
    const client = new OpenAI({
      apiKey: params.apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Cognita",
      },
    });
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = params.systemPrompt && params.userPrompt
      ? [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ]
      : [{ role: "user", content: params.prompt }];

    const response = await client.chat.completions.create({
      model: params.model,
      messages,
      temperature: params.temperature ?? 0.4,
      max_tokens: params.maxTokens ?? 700,
    });

    return {
      content: response.choices[0]?.message?.content?.trim() || "Nao consegui gerar uma resposta agora.",
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
      totalTokens: response.usage?.total_tokens,
      model: response.model || params.model,
    };
  }

  async generateEmbedding(params: GenerateEmbeddingParams): Promise<number[]> {
    void params;
    throw new Error("OpenRouter nao esta configurado como provedor de embeddings neste MVP. Use OpenAI para embeddings/RAG vetorial.");
  }
}
