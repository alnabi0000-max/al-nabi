/**
 * Foydalanuvchiga ko'rinadigan API / tarmoq xato matnlari
 */

export function friendlyApiError(
  err: unknown,
  tr: (key: string, vars?: Record<string, string | number>) => string
): string {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return tr("network_error");
  }

  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "";

  if (!msg) return tr("error_generic");

  if (
    /failed to fetch|networkerror|load failed|econnrefused|etimedout|abort/i.test(
      msg
    )
  ) {
    return tr("network_error");
  }

  if (
    /api.?key|missing key|not configured|unauthorized|401|403|ELEVENLABS|OPENROUTER|OPENAI|REPLICATE|STRIPE/i.test(
      msg
    )
  ) {
    return tr("api_key_missing");
  }

  if (/SENTINEL|etika|nsfw|forbidden|422/i.test(msg)) {
    return msg;
  }

  if (/generate failed|enhance failed|pipeline failed/i.test(msg)) {
    return tr("generate_failed");
  }

  return msg.length > 160 ? tr("error_generic") : msg;
}

export async function parseApiResponse<T = Record<string, unknown>>(
  res: Response
): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (
    trimmed.startsWith("<!DOCTYPE") ||
    trimmed.startsWith("<html") ||
    trimmed.startsWith("<HTML")
  ) {
    throw new Error(
      res.ok
        ? "Server returned HTML instead of JSON"
        : `Server error (HTTP ${res.status}) — restart dev server if this persists`
    );
  }

  let data: T;
  try {
    data = (trimmed ? JSON.parse(trimmed) : {}) as T;
  } catch {
    throw new Error(
      res.ok
        ? "Invalid JSON"
        : `HTTP ${res.status}: ${trimmed.slice(0, 120) || "empty response"}`
    );
  }
  if (!res.ok) {
    const err =
      (data as { error?: string; message?: string }).error ||
      (data as { message?: string }).message ||
      `HTTP ${res.status}`;
    throw new Error(err);
  }
  return data;
}
