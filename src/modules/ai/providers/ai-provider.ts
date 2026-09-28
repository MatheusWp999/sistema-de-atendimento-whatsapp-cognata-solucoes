import type {
  GenerateEmbeddingParams,
  GenerateResponseParams,
  GenerateResponseResult,
} from "@/types";

export interface AIProvider {
  generateResponse(params: GenerateResponseParams): Promise<GenerateResponseResult>;
  generateEmbedding(params: GenerateEmbeddingParams): Promise<number[]>;
}
