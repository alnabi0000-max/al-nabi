/**
 * OpenRouter — yagona Text & Prompt Enrichment handler
 * OpenAI-compatible: https://openrouter.ai/api/v1
 */

import OpenAI from "openai";

const OPENROUTER_BASE =
  process.env.OPENROUTER_BASE_URL?.trim() ||
  "https://openrouter.ai/api/v1";

export function getOpenRouterApiKey(): string | null {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key || key.includes("...") || key === "sk-or-...") return null;
  return key;
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(getOpenRouterApiKey());
}

export function getOpenRouterModel(): string {
  return (
    process.env.OPENROUTER_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "openai/gpt-4o-mini"
  );
}

/** Prompt auto-enhancer — Claude 3.5 Sonnet via same OpenRouter key */
export function getEnhanceModel(): string {
  return (
    process.env.OPENROUTER_ENHANCE_MODEL?.trim() ||
    "anthropic/claude-3.5-sonnet"
  );
}

/** Admin model-watcher — cheap classifier via same OpenRouter key */
export function getWatcherModel(): string {
  return (
    process.env.OPENROUTER_WATCHER_MODEL?.trim() || "openai/gpt-4o-mini"
  );
}

/** OpenAI SDK → OpenRouter gateway */
export function createOpenRouterClient(): OpenAI | null {
  const key = getOpenRouterApiKey();
  if (!key) return null;
  return new OpenAI({
    apiKey: key,
    baseURL: OPENROUTER_BASE,
    defaultHeaders: {
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_APP_URL || "https://alnabiy.app",
      "X-Title": "Al-Nabi Native Engine",
    },
  });
}

export type ChatTextPart = { type: "text"; text: string };
export type ChatImagePart = {
  type: "image_url";
  image_url: { url: string; detail?: "low" | "high" | "auto" };
};
export type ChatContent = string | Array<ChatTextPart | ChatImagePart>;

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: ChatContent;
};

/** Vision / Producer Chat — multimodal OpenRouter model */
export function getVisionModel(): string {
  return (
    process.env.OPENROUTER_VISION_MODEL?.trim() ||
    process.env.OPENROUTER_ENHANCE_MODEL?.trim() ||
    "openai/gpt-4o"
  );
}

/**
 * Chat completion — text + optional vision (same OpenRouter key only).
 */
export async function openRouterChat(opts: {
  messages: ChatMessage[];
  temperature?: number;
  json?: boolean;
  model?: string;
  /** Default 25s — enhance hang oldini olish */
  timeoutMs?: number;
}): Promise<string | null> {
  const client = createOpenRouterClient();
  if (!client) return null;

  const timeoutMs = opts.timeoutMs ?? 25_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await client.chat.completions.create(
      {
        model: opts.model || getOpenRouterModel(),
        temperature: opts.temperature ?? 0.6,
        ...(opts.json
          ? { response_format: { type: "json_object" as const } }
          : {}),
        messages: opts.messages as OpenAI.Chat.ChatCompletionMessageParam[],
      },
      { signal: controller.signal }
    );
    return res.choices[0]?.message?.content?.trim() || null;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      console.warn("[Alnabiy] OpenRouter chat timed out", timeoutMs);
      return null;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
