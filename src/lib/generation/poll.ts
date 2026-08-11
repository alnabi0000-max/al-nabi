import { progressFromStatus } from "@/lib/generation/progress";

export type GenerationStatusPayload = {
  ok: boolean;
  done?: boolean;
  failed?: boolean;
  status?: string;
  resultUrl?: string | null;
  videoUrl?: string | null;
  imageUrl?: string | null;
  r2Key?: string | null;
  errorMessage?: string | null;
  error?: string;
  percent?: number;
  stage?: string;
};

function softPollDefaults() {
  const soft =
    typeof process !== "undefined" &&
    (process.env.NEXT_PUBLIC_ALNABIY_MODE === "development" ||
      process.env.NEXT_PUBLIC_AUTH_MODE === "local" ||
      process.env.NODE_ENV === "development");
  return {
    intervalMs: soft ? 800 : 2000,
    /** Dev/local: 120s yetarli; prod: 5 daqiqa */
    timeoutMs: soft ? 120_000 : 300_000,
  };
}

/**
 * Poll /api/generations/[id]/status until done/failed or timeout.
 */
export async function pollGenerationStatus(
  generationId: string,
  opts?: {
    alnabiyKey?: string | null;
    intervalMs?: number;
    timeoutMs?: number;
    onUpdate?: (payload: GenerationStatusPayload) => void;
  }
): Promise<GenerationStatusPayload> {
  const defaults = softPollDefaults();
  const intervalMs = opts?.intervalMs ?? defaults.intervalMs;
  const timeoutMs = opts?.timeoutMs ?? defaults.timeoutMs;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    /* Key sent via header only — never as a URL query param (Referer/log leak) */
    let res: Response;
    try {
      res = await fetch(`/api/generations/${generationId}/status`, {
        credentials: "include",
        headers: opts?.alnabiyKey
          ? { "x-alnabiy-key": opts.alnabiyKey }
          : undefined,
        cache: "no-store",
      });
    } catch {
      await new Promise((r) => setTimeout(r, intervalMs));
      continue;
    }

    let data: GenerationStatusPayload;
    try {
      data = (await res.json()) as GenerationStatusPayload;
    } catch {
      await new Promise((r) => setTimeout(r, intervalMs));
      continue;
    }

    if (!res.ok) {
      /* transient 5xx — poll davom etsin */
      if (res.status >= 500) {
        await new Promise((r) => setTimeout(r, intervalMs));
        continue;
      }
      const fail: GenerationStatusPayload = {
        ok: false,
        failed: true,
        error: data.error || `HTTP ${res.status}`,
        percent: 100,
        stage: "failed",
      };
      opts?.onUpdate?.(fail);
      return fail;
    }

    const prog = progressFromStatus(data.status);
    const enriched: GenerationStatusPayload = {
      ...data,
      percent: prog.percent,
      stage: prog.stage,
    };
    opts?.onUpdate?.(enriched);

    if (data.done || data.failed) return enriched;
    if (data.resultUrl || data.videoUrl || data.imageUrl) {
      return { ...enriched, done: true, ok: true };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  const timeout: GenerationStatusPayload = {
    ok: false,
    failed: true,
    error: "Generation timed out",
    percent: 100,
    stage: "failed",
  };
  opts?.onUpdate?.(timeout);
  return timeout;
}
