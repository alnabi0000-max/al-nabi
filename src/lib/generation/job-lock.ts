import { isUpstashConfigured } from "@/lib/security/upstash-config";

const LOCK_TTL_SEC = 15 * 60;

function lockKey(generationId: string): string {
  return `alnabiy:gen-lock:${generationId}`;
}

/**
 * Dedupes overlapping Inngest retries / local `after()` workers for the same
 * Generation row. When Upstash is not configured, processing is allowed
 * (in-memory / single-process local dev).
 */
export async function acquireGenerationJobLock(
  generationId: string
): Promise<"acquired" | "busy" | "skipped"> {
  const id = generationId.trim();
  if (!id) return "skipped";
  if (!isUpstashConfigured()) return "skipped";
  try {
    const { Redis } = await import("@upstash/redis");
    const redis = Redis.fromEnv();
    const ok = await redis.set(lockKey(id), "1", {
      nx: true,
      ex: LOCK_TTL_SEC,
    });
    return ok ? "acquired" : "busy";
  } catch (error) {
    console.warn("[Alnabiy] generation job lock acquire failed", error);
    return "skipped";
  }
}

export async function releaseGenerationJobLock(
  generationId: string
): Promise<void> {
  const id = generationId.trim();
  if (!id || !isUpstashConfigured()) return;
  try {
    const { Redis } = await import("@upstash/redis");
    await Redis.fromEnv().del(lockKey(id));
  } catch (error) {
    console.warn("[Alnabiy] generation job lock release failed", error);
  }
}
