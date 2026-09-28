import { NextResponse } from "next/server";
import OpenAI from "openai";
import { apiError } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const { apiKey } = await request.json();
    if (typeof apiKey !== "string" || !apiKey.trim() || apiKey.length > 500) return apiError(new Error("Chave invalida"), 400);
    const client = new OpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" });
    const models = await client.models.list();
    return NextResponse.json({ ok: true, sampleModel: models.data[0]?.id ?? null });
  } catch (error) {
    return apiError(error, 400);
  }
}
