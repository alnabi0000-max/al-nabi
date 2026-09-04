"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Clapperboard, Film, Loader2, Sparkles, Wand2 } from "lucide-react";
import { useMaster } from "@/context/MasterControllerContext";
import { scrollToMediaViewer } from "@/lib/media-viewer-scroll";
import { scanHalol } from "@/lib/halol";
import { friendlyApiError, parseApiResponse } from "@/lib/api-errors";
import {
  calculateGenerationCost,
  calculateMovieCredits,
  type EmotionMode,
} from "@/lib/credits";
import { InsufficientBalanceHint } from "@/components/InsufficientBalanceHint";
import type { RenderStage } from "@/lib/generation/progress";
import {
  isSuccessfulGenerateResponse,
  type GenerateQueuedResponse,
} from "@/lib/generation/types";
import { LOCAL_FALLBACK_VIDEO, publicGenerationError } from "@/lib/generation/pipeline";
import { fetchWithTimeout } from "@/lib/api/fetch-timeout";
import clsx from "clsx";
import { BgmPicker } from "@/components/BgmPicker";
import type { BgmMode } from "@/lib/bgm/types";
import { DEFAULT_BGM_SELECTION } from "@/lib/bgm/types";

const MediaViewer = dynamic(
  () =>
    import("@/components/MediaViewer").then((m) => ({ default: m.MediaViewer })),
  { ssr: false }
);

const ViralHooksPanel = dynamic(
  () =>
    import("@/components/ViralHooksPanel").then((m) => ({
      default: m.ViralHooksPanel,
    })),
  { ssr: false }
);

type HubMode = "prompt" | "script";

/**
 * Bosh sahifa — Prompt-to-Video / Script + Enhance + real-time progress
 */
export function StudioHub() {
  const {
    tr,
    locale,
    coins,
    alnabiyKey,
    applyServerCharge,
    setShowInsufficientModal,
    handleViolation,
    isOffline,
    notify,
    ensureAuthSession,
  } = useMaster();
  const [mode, setMode] = useState<HubMode>("prompt");
  const [prompt, setPrompt] = useState("");
  const [script, setScript] = useState("");
  const [emotionMode] = useState<EmotionMode>("epic");
  const [bgmMode, setBgmMode] = useState<BgmMode>(DEFAULT_BGM_SELECTION.mode);
  const [bgmTrackId, setBgmTrackId] = useState<string | null>(
    DEFAULT_BGM_SELECTION.trackId
  );
  const [loading, setLoading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [previewA, setPreviewA] = useState<string | null>(null);
  const [previewB, setPreviewB] = useState<string | null>(null);
  const [activePreview, setActivePreview] = useState<"A" | "B">("A");
  const [error, setError] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [renderStage, setRenderStage] = useState<RenderStage>("queued");
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [r2Key, setR2Key] = useState<string | null>(null);

  function showApiError(e: unknown) {
    const message = friendlyApiError(e, tr);
    setError(message);
    notify({ message, type: "error", title: tr("error_generic") });
  }

  const durationSec = mode === "prompt" ? 10 : 60;
  const cost = useMemo(
    () =>
      mode === "prompt"
        ? calculateGenerationCost("prompt_to_video", durationSec)
        : calculateMovieCredits(durationSec),
    [mode, durationSec]
  );

  async function autoEnhance() {
    const text = mode === "prompt" ? prompt : script;
    if (!text.trim() || isOffline) return;
    if (scanHalol(text).blocked) {
      handleViolation();
      return;
    }
    setEnhancing(true);
    setError(null);
    try {
      const res = await fetchWithTimeout(
        "/api/enhance",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: text,
            style: "cinematic",
            locale,
            alnabiyKey,
          }),
        },
        30_000
      );
      const data = await parseApiResponse<{ enhanced: string }>(res);
      if (!data.enhanced?.trim()) throw new Error(tr("enhance_failed") || "Enhance failed");
      if (mode === "prompt") setPrompt(data.enhanced);
      else setScript(data.enhanced);
      notify({ message: tr("enhance_prompt_hint"), type: "success" });
    } catch (e) {
      showApiError(e);
    } finally {
      setEnhancing(false);
    }
  }

  async function create() {
    const text = mode === "prompt" ? prompt : script;
    if (!text.trim() || isOffline) return;
    if (mode === "script" && text.trim().length < 40) {
      const message = tr("script_min_length");
      setError(message);
      notify({ message, type: "error", title: tr("error_generic") });
      return;
    }
    if (scanHalol(text).blocked) {
      handleViolation();
      return;
    }
    if (coins < cost) {
      setShowInsufficientModal(true);
      return;
    }

    setLoading(true);
    setError(null);
    setProgressPercent(8);
    setRenderStage("queued");
    setGenerationId(null);
    setR2Key(null);
    requestAnimationFrame(() => scrollToMediaViewer());
    try {
      const session = await ensureAuthSession();
      const key = session?.alnabiyKey || alnabiyKey || undefined;
      if (mode === "prompt") {
        const res = await fetchWithTimeout(
          "/api/generate",
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: text,
              style: "cinematic",
              durationSec,
              autoEnhance: false,
              emotionMode,
              locale,
              mediaKind: "video",
              alnabiyKey: key,
              clientBalance: coins,
              engine: "auto",
              bgmMode,
              bgmTrackId,
            }),
          },
          120_000
        );
        let data: GenerateQueuedResponse;
        try {
          data = await parseApiResponse<GenerateQueuedResponse>(res);
        } catch {
          throw new Error(res.ok ? "Invalid JSON" : `HTTP ${res.status}`);
        }
        if (res.status === 402 || data.code === "INSUFFICIENT") {
          applyServerCharge({ ok: false, code: "INSUFFICIENT" });
          return;
        }
        if (
          !isSuccessfulGenerateResponse(data) &&
          (!res.ok || data.ok === false || data.status === "FAILED")
        ) {
          /* /api/generate may return HTTP 200 with ok:false/status:FAILED
           * after charging + auto-refunding server-side — sync the
           * post-refund balance instead of leaving the stale pre-refund one. */
          if (typeof data.balanceAfter === "number") {
            applyServerCharge({
              ok: true,
              balanceAfter: data.balanceAfter as number,
            });
          }
          const exact = publicGenerationError(data);
          console.error(
            "[Al-Nabi][pipeline][queue]",
            data.errorCode || data.pipelineStage || "QUEUE_FAILED",
            exact,
            data.pipelineLog
          );
          setError(exact);
          if (data.recovered || data.instantMock || data.fallbackUrl) {
            setPreviewA(
              data.resultUrl ||
                data.videoUrl ||
                data.fallbackUrl ||
                LOCAL_FALLBACK_VIDEO
            );
            setProgressPercent(100);
            setRenderStage("completed");
            return;
          }
          throw new Error(exact);
        }
        applyServerCharge({
          ok: true,
          cost: data.creditsCost as number | undefined,
          balanceAfter: data.balanceAfter as number | undefined,
          receiptId: data.receiptId as string | undefined,
          label: tr("create_with_alnabiy"),
        });

        let url = (data.resultUrl || data.videoUrl) as string | undefined;
        const gid = (data.generationId || data.jobId) as string | undefined;
        if (gid) setGenerationId(gid);

        const alreadyDone = Boolean(
          data.done || data.status === "COMPLETED" || url
        );
        if (alreadyDone) {
          setProgressPercent(100);
          setRenderStage("completed");
          if (typeof data.r2Key === "string") setR2Key(data.r2Key);
        } else if (data.queued && gid) {
          const { waitForGenerationStatus } = await import(
            "@/hooks/useGenerationStatus"
          );
          const status = await waitForGenerationStatus(String(gid), {
            alnabiyKey: key,
            timeoutMs: 300_000,
            onUpdate: (p) => {
              if (typeof p.percent === "number") setProgressPercent(p.percent);
              if (p.stage) setRenderStage(p.stage as RenderStage);
            },
          });
          if (status.failed) {
            setRenderStage("failed");
            throw new Error(
              status.errorMessage || status.error || tr("generate_failed")
            );
          }
          url =
            (status.resultUrl || status.videoUrl || undefined) as
              | string
              | undefined;
          if (status.r2Key) setR2Key(status.r2Key);
          setProgressPercent(100);
          setRenderStage("completed");
        }

        if (url && key && url.startsWith("/api/media/") && !url.includes("key=")) {
          const join = url.includes("?") ? "&" : "?";
          url = `${url}${join}key=${encodeURIComponent(key)}`;
        }
        setPreviewA(url || null);
        setPreviewB(null);
        setActivePreview("A");
      } else {
        const q = new URLSearchParams({
          prompt: text,
          bgmMode,
        });
        if (bgmTrackId) q.set("bgmTrackId", bgmTrackId);
        window.location.href = `/script-to-movie?${q.toString()}`;
        return;
      }
    } catch (e) {
      showApiError(e);
      setRenderStage("failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section>
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-nabi-neon">
          {tr("home_eyebrow")}
        </p>
        <h1 className="mb-3 bg-gradient-to-r from-white via-nabi-gold to-nabi-neon bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-5xl">
          Al-Nabi
        </h1>
        <p className="max-w-xl text-nabi-muted">{tr("home_tagline")}</p>
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("prompt")}
          className={clsx(
            "nabi-btn-ghost inline-flex items-center gap-2",
            mode === "prompt" && "nabi-select-on"
          )}
        >
          <Clapperboard size={16} />
          {tr("mode_prompt")}
        </button>
        <button
          type="button"
          onClick={() => setMode("script")}
          className={clsx(
            "nabi-btn-ghost inline-flex items-center gap-2",
            mode === "script" && "nabi-select-on"
          )}
        >
          <Film size={16} />
          {tr("mode_script_film")}
        </button>
        <Link href="/generate" className="nabi-btn-ghost !text-xs ml-auto">
          {tr("studio_title")} →
        </Link>
      </div>

      <div className="nabi-card space-y-3 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-nabi-neon to-[var(--accent-to)] opacity-60" />
        <div className="flex items-center justify-between gap-2">
          <label className="text-sm font-medium text-nabi-muted">
            {mode === "prompt" ? tr("prompt_label") : tr("script_label")}
          </label>
          <button
            type="button"
            onClick={autoEnhance}
            disabled={enhancing || isOffline}
            className="nabi-btn-ghost !py-1.5 !text-xs inline-flex items-center gap-1.5"
            title={tr("enhance_prompt_hint")}
          >
            {enhancing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Wand2 size={14} />
            )}
            {tr("enhance_prompt")}
          </button>
        </div>
        <p className="text-[10px] text-nabi-muted">{tr("enhance_prompt_hint")}</p>
        <textarea
          className="nabi-input min-h-[140px] resize-y"
          placeholder={
            mode === "prompt"
              ? tr("prompt_placeholder")
              : tr("script_placeholder")
          }
          value={mode === "prompt" ? prompt : script}
          onChange={(e) =>
            mode === "prompt"
              ? setPrompt(e.target.value)
              : setScript(e.target.value)
          }
        />
        <div className="space-y-3 border-t border-nabi-border pt-3">
          <BgmPicker
            mode={bgmMode}
            trackId={bgmTrackId}
            onModeChange={setBgmMode}
            onTrackChange={setBgmTrackId}
            disabled={loading}
            labels={{
              title: tr("bgm_title"),
              ai: tr("bgm_ai"),
              manual: tr("bgm_manual"),
              off: tr("bgm_off"),
              aiHint: tr("bgm_ai_hint"),
              empty: tr("bgm_empty"),
              loading: tr("bgm_loading"),
            }}
          />
          <InsufficientBalanceHint
            kind={mode === "prompt" ? "prompt_to_video" : "text_to_movie"}
            cost={cost}
            coins={coins}
            durationSec={durationSec}
            durationCandidates={
              mode === "prompt" ? [5, 10, 15] : [30, 60, 180, 300, 600]
            }
            storeLabel={tr("store")}
            tryDurationLabel={(sec, nc) =>
              tr("try_shorter_duration")
                .replace(
                  "{duration}",
                  sec < 60 ? `${sec}s` : `${Math.round(sec / 60)} min`
                )
                .replace("{cost}", String(nc))
            }
            tr={tr}
          />
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={create}
              disabled={loading || isOffline || coins < cost}
              className="nabi-btn-primary min-w-[14rem]"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              <span>
                {tr("create_with_alnabiy")}
                <span className="mx-1.5 opacity-50">•</span>
                <span className="tabular-nums text-nabi-gold">
                  {cost.toLocaleString()} {tr("coins")}
                </span>
              </span>
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
      </div>

      <MediaViewer
        loading={loading}
        videoUrl={previewA}
        videoUrlB={previewB}
        activePreview={activePreview}
        onSelectPreview={setActivePreview}
        progressPercent={progressPercent}
        renderStage={renderStage}
        generationId={generationId}
        r2Key={r2Key}
        mediaTitle={mode === "prompt" ? prompt.slice(0, 60) : "Al-Nabi Film"}
      />

      <ViralHooksPanel
        videoUrl={activePreview === "A" ? previewA : previewB}
        scriptOrPrompt={mode === "prompt" ? prompt : script}
        emotionMode={emotionMode}
        durationSec={durationSec}
      />
    </div>
  );
}
