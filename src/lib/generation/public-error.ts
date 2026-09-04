/**
 * Sanitize provider/vendor error strings before DB storage or client APIs.
 * Never expose Replicate / Fal / OpenRouter / ElevenLabs / model paths.
 */

const VENDOR_RE =
  /\b(replicate|fal\.?ai|openrouter|elevenlabs|anthropic|openai|kling|runway|luma|seedance|minimax|flux\.?1|stability|sd3\.5|kwaivgi|wavespeedai|black.?forest)\b/gi;

const URL_RE = /https?:\/\/[^\s)]+/gi;
const KEY_HINT_RE =
  /\b(api[_-]?key|bearer|token|r8_[a-z0-9]+|sk-[a-z0-9-]+)\b/gi;

export function sanitizeGenerationError(
  err: unknown,
  fallback = "Generation failed. Credits were refunded if charged."
): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "";

  if (!raw.trim()) return fallback;

  let msg = raw
    .replace(URL_RE, "[redacted]")
    .replace(KEY_HINT_RE, "[redacted]")
    .replace(VENDOR_RE, "Al-Nabi Studio")
    .replace(/\b\d{3}\b/g, (code) => {
      // keep generic HTTP-ish codes as soft signals
      if (code === "402") return "billing";
      if (code === "401" || code === "403") return "auth";
      if (code === "429") return "rate-limit";
      return code;
    })
    .replace(/\s+/g, " ")
    .trim();

  if (/insufficient credit|payment required|billing/i.test(raw)) {
    return "Studio capacity temporarily unavailable. Credits refunded.";
  }
  if (/throttl|rate.?limit|429/i.test(raw)) {
    return "Studio is busy. Please retry shortly. Credits refunded.";
  }
  if (/unauthorized|forbidden|401|403|not configured|missing key/i.test(raw)) {
    return "Studio engine unavailable. Credits refunded.";
  }
  if (/econnreset|econnaborted|epipe|socket hang up|network reset/i.test(raw)) {
    return "Network reset while saving media. Credits refunded.";
  }
  if (/timeout|etimedout|aborted/i.test(raw)) {
    return "Generation timed out. Credits refunded.";
  }
  if (/empty (url|output)|provider returned empty/i.test(raw)) {
    return "Studio returned an empty result. Credits refunded.";
  }

  // If still looks vendor-specific, use fallback
  if (/\b(replicate|fal|openrouter|elevenlabs|kling|runway)\b/i.test(msg)) {
    return fallback;
  }

  return msg.slice(0, 280) || fallback;
}

export async function captureGenerationFailure(
  err: unknown,
  context: { generationId: string; area: string }
): Promise<void> {
  console.error(
    `[Al-Nabi] generation failure (${context.area})`,
    context.generationId,
    err instanceof Error ? err.message : err
  );
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(err, {
      tags: { area: context.area, product: "al-nabi" },
      extra: { generationId: context.generationId },
    });
  } catch {
    /* soft */
  }
}
