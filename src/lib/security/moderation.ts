import * as Sentry from "@sentry/nextjs";
import { openRouterChat, isOpenRouterConfigured } from "@/lib/ai/openrouter";

export type ModerationResult = {
  allowed: boolean;
  flagged: boolean;
  categories: string[];
  provider: "openrouter" | "skipped";
  reason?: string;
};

/**
 * Content safety — OpenRouter LLM check (Sentinel/Halol hali ham ishlaydi).
 * OPENROUTER_API_KEY yo‘q bo‘lsa soft-skip.
 */
export async function moderateText(
  input: string,
  opts?: { throwOnError?: boolean }
): Promise<ModerationResult> {
  if (!isOpenRouterConfigured()) {
    return {
      allowed: true,
      flagged: false,
      categories: [],
      provider: "skipped",
      reason: "OPENROUTER_API_KEY not configured",
    };
  }

  try {
    const raw = await openRouterChat({
      temperature: 0,
      json: true,
      messages: [
        {
          role: "system",
          content: `You are a strict content safety classifier for a video platform.
Return JSON only: {"allowed": boolean, "categories": string[], "reason": string}
Block NSFW, sexual minors, extreme violence, hate, illegal weapons instructions.
Allow artistic cinematic violence and fiction.`,
        },
        { role: "user", content: input.slice(0, 8000) },
      ],
    });

    const parsed = JSON.parse(raw || "{}") as {
      allowed?: boolean;
      categories?: string[];
      reason?: string;
    };
    const allowed = parsed.allowed !== false;
    const cats = Array.isArray(parsed.categories) ? parsed.categories : [];
    return {
      allowed,
      flagged: !allowed,
      categories: cats,
      provider: "openrouter",
      reason: allowed
        ? undefined
        : parsed.reason ||
          `Moderation blocked: ${cats.join(", ") || "policy"}`,
    };
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "moderation" } });
    if (opts?.throwOnError) throw e;
    const prod = process.env.NODE_ENV === "production";
    const strict =
      process.env.MODERATION_FAIL_CLOSED === "1" ||
      process.env.NEXT_PUBLIC_ALNABIY_MODE === "production";
    if (prod && strict) {
      return {
        allowed: false,
        flagged: true,
        categories: ["moderation_error"],
        provider: "openrouter",
        reason: "Moderation unavailable — request rejected",
      };
    }
    return {
      allowed: true,
      flagged: false,
      categories: [],
      provider: "skipped",
      reason: "moderation_error_soft",
    };
  }
}
