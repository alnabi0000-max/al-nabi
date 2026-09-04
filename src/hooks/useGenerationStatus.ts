"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GenerationStatusPayload } from "@/lib/generation/poll";
import { progressFromStatus } from "@/lib/generation/progress";

export type UseGenerationStatusOpts = {
  generationId: string | null;
  alnabiyKey?: string | null;
  enabled?: boolean;
  /** SSE timeout (ms) */
  timeoutMs?: number;
  onUpdate?: (payload: GenerationStatusPayload) => void;
};

/**
 * PERF-01: SSE-first generation status (`?stream=1`), HTTP poll fallback.
 */
export function useGenerationStatus(opts: UseGenerationStatusOpts) {
  const {
    generationId,
    alnabiyKey,
    enabled = true,
    timeoutMs = 300_000,
    onUpdate,
  } = opts;
  const [payload, setPayload] = useState<GenerationStatusPayload | null>(null);
  const [listening, setListening] = useState(false);
  const onUpdateRef = useRef(onUpdate);
  const payloadRef = useRef<GenerationStatusPayload | null>(null);
  onUpdateRef.current = onUpdate;

  const apply = useCallback((data: GenerationStatusPayload) => {
    const prog = progressFromStatus(data.status);
    const enriched: GenerationStatusPayload = {
      ...data,
      percent: data.percent ?? prog.percent,
      stage: data.stage || prog.stage,
    };
    payloadRef.current = enriched;
    setPayload(enriched);
    onUpdateRef.current?.(enriched);
    return enriched;
  }, []);

  useEffect(() => {
    if (!enabled || !generationId) return;

    let cancelled = false;
    let terminal = false;
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    const started = Date.now();
    setListening(true);

    const finish = () => {
      terminal = true;
      setListening(false);
      if (es) {
        es.close();
        es = null;
      }
      if (pollTimer) clearTimeout(pollTimer);
    };

    const pollOnce = async (): Promise<GenerationStatusPayload | null> => {
      /* Key sent via header only — never as a URL query param (Referer/log leak) */
      const res = await fetch(
        `/api/generations/${generationId}/status`,
        {
          credentials: "include",
          headers: alnabiyKey
            ? { "x-alnabiy-key": alnabiyKey }
            : undefined,
          cache: "no-store",
        }
      );
      const data = (await res.json()) as GenerationStatusPayload;
      if (!res.ok) {
        return apply({
          ok: false,
          failed: true,
          error: data.error || `HTTP ${res.status}`,
          percent: 100,
          stage: "failed",
        });
      }
      return apply(data);
    };

    const startPollFallback = () => {
      const tick = async () => {
        if (cancelled) return;
        if (Date.now() - started > timeoutMs) {
          apply({
            ok: false,
            failed: true,
            error: "Generation timed out",
            errorCode: "TIMEOUT",
            pipelineStage: "queue",
            percent: 100,
            stage: "failed",
          });
          finish();
          return;
        }
        try {
          const data = await pollOnce();
          if (data?.done || data?.failed) {
            finish();
            return;
          }
        } catch {
          /* retry */
        }
        pollTimer = setTimeout(tick, 1500);
      };
      void tick();
    };

    try {
      es = new EventSource(
        `/api/generations/${generationId}/status?stream=1`,
        { withCredentials: true }
      );
      es.onmessage = (ev) => {
        if (cancelled || terminal) return;
        try {
          const data = JSON.parse(ev.data) as GenerationStatusPayload;
          const enriched = apply(data);
          if (enriched.done || enriched.failed) finish();
        } catch {
          /* ignore bad chunk */
        }
      };
      es.onerror = () => {
        if (cancelled || terminal) return;
        es?.close();
        es = null;
        startPollFallback();
      };
    } catch {
      startPollFallback();
    }

    const hardStop = setTimeout(() => {
      if (cancelled || terminal) return;
      if (!payloadRef.current?.done && !payloadRef.current?.failed) {
        apply({
          ok: false,
          failed: true,
          error: "Generation timed out",
          percent: 100,
          stage: "failed",
        });
      }
      finish();
    }, timeoutMs);

    return () => {
      cancelled = true;
      clearTimeout(hardStop);
      finish();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generationId, alnabiyKey, enabled, timeoutMs, apply]);

  return { payload, listening };
}

/**
 * One-shot SSE/poll until done — generate page / StudioHub uchun.
 */
export async function waitForGenerationStatus(
  generationId: string,
  opts?: {
    alnabiyKey?: string | null;
    timeoutMs?: number;
    onUpdate?: (payload: GenerationStatusPayload) => void;
  }
): Promise<GenerationStatusPayload> {
  const timeoutMs = opts?.timeoutMs ?? 300_000;

  return new Promise((resolve) => {
    let settled = false;
    const done = (p: GenerationStatusPayload) => {
      if (settled) return;
      settled = true;
      try {
        es?.close();
      } catch {
        /* soft */
      }
      resolve(p);
    };

    let es: EventSource | null = null;
    const started = Date.now();

    const pollFallback = async () => {
      const { pollGenerationStatus } = await import("@/lib/generation/poll");
      const result = await pollGenerationStatus(generationId, {
        alnabiyKey: opts?.alnabiyKey,
        timeoutMs: Math.max(5_000, timeoutMs - (Date.now() - started)),
        onUpdate: opts?.onUpdate,
      });
      done(result);
    };

    try {
      es = new EventSource(
        `/api/generations/${generationId}/status?stream=1`,
        { withCredentials: true }
      );
      const timer = setTimeout(() => {
        es?.close();
        void pollFallback();
      }, timeoutMs);

      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as GenerationStatusPayload;
          const prog = progressFromStatus(data.status);
          const enriched = { ...data, percent: prog.percent, stage: prog.stage };
          opts?.onUpdate?.(enriched);
          if (enriched.done || enriched.failed) {
            clearTimeout(timer);
            done(enriched);
          }
        } catch {
          /* ignore */
        }
      };
      es.onerror = () => {
        if (settled) return;
        clearTimeout(timer);
        es?.close();
        void pollFallback();
      };
    } catch {
      void pollFallback();
    }
  });
}
