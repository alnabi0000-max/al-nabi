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

/** Prompt auto-enhancer / Producer Chat — same OpenRouter key */
export function getEnhanceModel(): string {
  const explicit = process.env.OPENROUTER_ENHANCE_MODEL?.trim();
  if (explicit) return explicit;
  const routed = process.env.OPENROUTER_MODEL?.trim();
  if (routed) return routed;
  const openai = process.env.OPENAI_MODEL?.trim();
  if (openai) return openai.includes("/") ? openai : `openai/${openai}`;
  // Prefer a widely available tool-calling model (legacy Claude id may 404)
  return "openai/gpt-4o-mini";
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

export type ChatToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type OpenRouterToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type OpenRouterChatResult = {
  content: string | null;
  toolCalls: OpenRouterToolCall[];
  /** Assistant message to append before tool results (when toolCalls present). */
  assistantMessage: OpenAI.Chat.ChatCompletionAssistantMessageParam | null;
};

/**
 * Chat completion — text + optional vision (same OpenRouter key only).
 */
export async function openRouterChat(opts: {
  messages: ChatMessage[] | OpenAI.Chat.ChatCompletionMessageParam[];
  temperature?: number;
  json?: boolean;
  model?: string;
  /** Default 25s — enhance hang oldini olish */
  timeoutMs?: number;
  tools?: ChatToolDefinition[];
  toolChoice?: "auto" | "none" | "required";
}): Promise<string | null> {
  const result = await openRouterChatRaw(opts);
  return result?.content ?? null;
}

/** Full completion including optional tool_calls (OpenAI-compatible). */
export async function openRouterChatRaw(opts: {
  messages: ChatMessage[] | OpenAI.Chat.ChatCompletionMessageParam[];
  temperature?: number;
  json?: boolean;
  model?: string;
  timeoutMs?: number;
  tools?: ChatToolDefinition[];
  toolChoice?: "auto" | "none" | "required";
}): Promise<OpenRouterChatResult | null> {
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
        ...(opts.json && !opts.tools?.length
          ? { response_format: { type: "json_object" as const } }
          : {}),
        ...(opts.tools?.length
          ? {
              tools: opts.tools as OpenAI.Chat.ChatCompletionTool[],
              tool_choice: opts.toolChoice ?? "auto",
            }
          : {}),
        messages: opts.messages as OpenAI.Chat.ChatCompletionMessageParam[],
      },
      { signal: controller.signal }
    );
    const msg = res.choices[0]?.message;
    if (!msg) {
      return { content: null, toolCalls: [], assistantMessage: null };
    }
    const toolCalls: OpenRouterToolCall[] = (msg.tool_calls || [])
      .filter((t) => t.type === "function" && t.function?.name)
      .map((t) => ({
        id: t.id,
        type: "function" as const,
        function: {
          name: t.function.name,
          arguments: t.function.arguments || "{}",
        },
      }));
    return {
      content: msg.content?.trim() || null,
      toolCalls,
      assistantMessage:
        toolCalls.length > 0
          ? {
              role: "assistant",
              content: msg.content ?? null,
              tool_calls: toolCalls.map((t) => ({
                id: t.id,
                type: "function" as const,
                function: t.function,
              })),
            }
          : null,
    };
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
