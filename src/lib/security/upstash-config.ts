import { isPlaceholderEnvValue } from "@/lib/env";

/**
 * Distributed rate-limit backend. Both REST URL and token must be real
 * values — a URL without a token must not be treated as configured.
 */
export function isUpstashConfigured(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim() || "";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || "";
  if (isPlaceholderEnvValue(url) || isPlaceholderEnvValue(token)) return false;
  if (!url.startsWith("https://")) return false;
  return token.length >= 16;
}

const PING_TIMEOUT_MS = 2500;

export async function pingUpstash(): Promise<boolean | null> {
  if (!isUpstashConfigured()) return null;
  try {
    const { Redis } = await import("@upstash/redis");
    const redis = Redis.fromEnv();
    const pong = await Promise.race([
      redis.ping(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("upstash ping timeout")), PING_TIMEOUT_MS);
      }),
    ]);
    return typeof pong === "string"
      ? pong.toUpperCase() === "PONG"
      : Boolean(pong);
  } catch {
    return false;
  }
}
