/**
 * DeepSeek model factory. DeepSeek is OpenAI-compatible, so we use the AI SDK
 * OpenAI provider pointed at DEEPSEEK_BASE_URL (the v2 equivalent of the v1
 * `OpenAIAdapter({ baseURL })`). The model id comes from DEEPSEEK_MODEL so it
 * can change without code edits. The key never leaves the server.
 */
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { createMockModel } from "./mock-model";

export function llmConfigured(): boolean {
  return process.env.LLM_MOCK === "1" || Boolean(process.env.DEEPSEEK_API_KEY);
}

export function getModel(agent: "customer" | "owner"): LanguageModel {
  if (process.env.LLM_MOCK === "1") return createMockModel(agent);
  const provider = createOpenAI({
    name: "deepseek",
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    apiKey: process.env.DEEPSEEK_API_KEY,
  });
  return provider.chat(process.env.DEEPSEEK_MODEL || "deepseek-flash");
}
