import OpenAI from "openai";
import type { AIProvider } from "./ai-provider";
import type {
  GenerateEmbeddingParams,
  GenerateResponseParams,
  GenerateResponseResult,
} from "@/types";

export class OpenAIProvider implements AIProvider {
  async generateResponse(params: GenerateResponseParams): Promise<GenerateResponseResult> {
    const client = new OpenAI({ apiKey: params.apiKey });
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
      model: response.model,
    };
  }

  async generateEmbedding(params: GenerateEmbeddingParams): Promise<number[]> {
    const client = new OpenAI({ apiKey: params.apiKey });
    const response = await client.embeddings.create({
      model: params.model,
      input: params.input,
    });
    return response.data[0]?.embedding ?? [];
  }
}
