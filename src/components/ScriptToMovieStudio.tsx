"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Clapperboard, Loader2, Scissors, Wand2 } from "lucide-react";
import {
  calculateMovieCredits,
  CREDIT_RATES,
  EMOTION_MODES,
  formatCredits,
  type EmotionMode,
  type StyleKey,
} from "@/lib/credits";
import { InsufficientBalanceHint } from "@/components/InsufficientBalanceHint";
import { NcReceiptHistory } from "@/components/NcReceiptHistory";
import { pushHistory } from "@/lib/generation-history";
import { ViralHooksPanel } from "@/components/ViralHooksPanel";
import { MediaViewer } from "@/components/MediaViewer";
import { scrollToMediaViewer } from "@/lib/media-viewer-scroll";
import { RenderProgress } from "@/components/RenderProgress";
import {
  EpisodeBoard,
  type EpisodeSceneStatus,
} from "@/components/EpisodeBoard";
import { useMaster } from "@/context/MasterControllerContext";
import { scanHalol } from "@/lib/halol";
import { progressFromScenePipeline } from "@/lib/generation/progress";
import type { RenderStage } from "@/lib/generation/progress";
import type { CameraMovement, Scene } from "@/lib/types";
import { friendlyApiError, parseApiResponse } from "@/lib/api-errors";
import { fetchWithTimeout } from "@/lib/api/fetch-timeout";
import { ModelSwitcher } from "@/components/ModelSwitcher";
import { StudioAccordion } from "@/components/studio/studio-primitives";
import type {
  FrameRate,
  RenderQuality,
} from "@/lib/ai/catalog";
import { BgmPicker } from "@/components/BgmPicker";
import type { BgmMode } from "@/lib/bgm/types";
import { BGM_MODES, DEFAULT_BGM_SELECTION } from "@/lib/bgm/types";

const DURATIONS = [
  { sec: 30, label: "30s" },
  { sec: 60, label: "1 min" },
  { sec: 180, label: "3 min" },
  { sec: 300, label: "5 min" },
  { sec: 600, label: "10 min" },
];

const STYLE_KEYS: { id: StyleKey; labelKey: string }[] = [
  { id: "cinematic", labelKey: "style_cinematic" },
  { id: "cartoon", labelKey: "style_cartoon" },
  { id: "anime", labelKey: "style_anime" },
  { id: "realistic", labelKey: "style_realistic" },
];

export function ScriptToMovieStudio() {
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
  const [script, setScript] = useState("");
  const [style, setStyle] = useState<StyleKey>("cinematic");
  const [emotionMode, setEmotionMode] = useState<EmotionMode>("drama");
  const [bgmMode, setBgmMode] = useState<BgmMode>(DEFAULT_BGM_SELECTION.mode);
  const [bgmTrackId, setBgmTrackId] = useState<string | null>(
    DEFAULT_BGM_SELECTION.trackId
  );
  const [durationSec, setDurationSec] = useState(60);
  const [quality, setQuality] = useState<RenderQuality>("1080p");
  const [frameRate, setFrameRate] = useState<FrameRate>(24);
  const [camera, setCamera] = useState<CameraMovement>("orbit");
  const [phase, setPhase] = useState<
    "idle" | "analyzing" | "pipeline" | "done"
  >("idle");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [sceneStatus, setSceneStatus] = useState<
    Record<number, EpisodeSceneStatus>
  >({});
  const [activeScene, setActiveScene] = useState<number | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobMeta, setJobMeta] = useState<{
    jobId?: string;
    sceneCount?: number;
  }>({});
  const [progressPercent, setProgressPercent] = useState(0);
  const [renderStage, setRenderStage] = useState<RenderStage>("queued");
  const [enhancing, setEnhancing] = useState(false);
  const tickRef = useRef<number | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const qp = searchParams.get("prompt");
    if (qp && qp.length >= 40) setScript(qp);
    const emotion = searchParams.get("emotion");
    if (emotion && EMOTION_MODES.some((m) => m.id === emotion)) {
      setEmotionMode(emotion as EmotionMode);
    }
    const bm = searchParams.get("bgmMode");
    if (bm && (BGM_MODES as string[]).includes(bm)) {
      setBgmMode(bm as BgmMode);
    }
    const bt = searchParams.get("bgmTrackId");
    if (bt) setBgmTrackId(bt);
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, []);

  const credits = useMemo(
    () =>
      calculateMovieCredits(durationSec, {
        engine: "auto",
        quality,
        frameRate,
      }),
    [durationSec, quality, frameRate]
  );
  const loading = phase === "analyzing" || phase === "pipeline";

  function startSceneTicker(list: Scene[]) {
    if (tickRef.current) window.clearInterval(tickRef.current);
    let i = 0;
    setSceneStatus(
      Object.fromEntries(list.map((s) => [s.index, "pending" as const]))
    );
    setActiveScene(list[0]?.index ?? null);
    tickRef.current = window.setInterval(() => {
      const scene = list[i];
      if (!scene) {
        if (tickRef.current) window.clearInterval(tickRef.current);
        return;
      }
      setActiveScene(scene.index);
      setSceneStatus((prev) => ({ ...prev, [scene.index]: "audio" }));
      const prog = progressFromScenePipeline({
        sceneIndex: i,
        sceneCount: list.length,
        phase: "audio",
      });
      setProgressPercent(prog.percent);
      setRenderStage(prog.stage);

      window.setTimeout(() => {
        setSceneStatus((prev) => ({ ...prev, [scene.index]: "video" }));
        const p2 = progressFromScenePipeline({
          sceneIndex: i,
          sceneCount: list.length,
          phase: "video",
        });
        setProgressPercent(p2.percent);
        setRenderStage(p2.stage);
      }, 900);

      window.setTimeout(() => {
        setSceneStatus((prev) => ({ ...prev, [scene.index]: "done" }));
      }, 1800);

      i += 1;
      if (i >= list.length) {
        if (tickRef.current) window.clearInterval(tickRef.current);
        setRenderStage("merging");
        setProgressPercent(94);
      }
    }, 2200);
  }

  async function enhanceScript() {
    if (!script.trim() || isOffline) return;
    if (scanHalol(script).blocked) {
      handleViolation();
      return;
    }
    setEnhancing(true);
    try {
      const res = await fetchWithTimeout(
        "/api/enhance",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: script, style, locale, alnabiyKey }),
        },
        30_000
      );
      const data = await parseApiResponse<{ enhanced: string }>(res);
      if (!data.enhanced?.trim()) {
        throw new Error(tr("enhance_failed") || "Enhance failed");
      }
      setScript(data.enhanced);
      notify({ message: tr("enhance_prompt_hint"), type: "success" });
    } catch (e) {
      notify({
        message: friendlyApiError(e, tr),
        type: "error",
      });
    } finally {
      setEnhancing(false);
    }
  }

  async function analyzeOnly() {
    if (script.trim().length < 40) {
      setError(tr("script_min_length"));
      return;
    }
    if (scanHalol(script).blocked) {
      handleViolation();
      return;
    }
    setPhase("analyzing");
    setError(null);
    setProgressPercent(12);
    setRenderStage("analyzing");
    try {
      const res = await fetchWithTimeout(
        "/api/script/analyze",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script, durationSec, style, alnabiyKey }),
        },
        60_000
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analyze failed");
      const nextScenes: Scene[] = data.analysis?.scenes || [];
      setScenes(nextScenes);
      setJobMeta({ sceneCount: data.sceneCount });
      setSceneStatus(
        Object.fromEntries(nextScenes.map((s) => [s.index, "pending" as const]))
      );
      setProgressPercent(100);
      setRenderStage("completed");
      setPhase("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("error_generic"));
      setPhase("idle");
      setRenderStage("failed");
    }
  }

  async function runFullPipeline() {
    if (script.trim().length < 40) {
      setError(tr("script_min_length"));
      return;
    }
    if (scanHalol(script).blocked) {
      handleViolation();
      return;
    }
    if (coins < credits) {
      setShowInsufficientModal(true);
      return;
    }

    setPhase("pipeline");
    setError(null);
    setResultUrl(null);
    setProgressPercent(10);
    setRenderStage("analyzing");
    requestAnimationFrame(() => scrollToMediaViewer());

    try {
      // Avval sahnаlar bo‘lsa — UI ticker; yo‘q bo‘lsa analyze bilan boshlanadi
      if (scenes.length) {
        startSceneTicker(scenes);
      }

      const auth = await ensureAuthSession();
      const key = auth.alnabiyKey || alnabiyKey;
      /* Long synchronous multi-scene render — generous bound so the UI is
       * guaranteed to eventually recover (error + already-refunded server
       * side) instead of a spinner that spins forever on a stalled request. */
      const res = await fetchWithTimeout(
        "/api/script/pipeline",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            script,
            durationSec,
            style,
            emotionMode,
            locale,
            alnabiyKey: key,
            clientBalance: coins,
            engine: "auto",
            quality,
            frameRate,
            cameraMove: camera,
            bgmMode,
            bgmTrackId,
          }),
        },
        600_000
      );
      const data = await res.json();
      if (res.status === 402 || data.code === "INSUFFICIENT") {
        applyServerCharge({ ok: false, code: "INSUFFICIENT" });
        setPhase("idle");
        setRenderStage("failed");
        return;
      }
      if (!res.ok) throw new Error(data.error || tr("generate_failed"));

      applyServerCharge({
        ok: true,
        cost: data.creditsCost,
        balanceAfter: data.balanceAfter,
        receiptId: data.receiptId,
        label: tr("create_with_alnabiy"),
        kind: "text_to_movie",
      });

      const nextScenes: Scene[] = data.analysis?.scenes || scenes;
      setScenes(nextScenes);
      setSceneStatus(
        Object.fromEntries(nextScenes.map((s) => [s.index, "done" as const]))
      );
      if (tickRef.current) window.clearInterval(tickRef.current);

      let url = (data.resultUrl as string) || null;
      if (url && alnabiyKey && url.startsWith("/api/media/")) {
        const join = url.includes("?") ? "&" : "?";
        url = `${url}${join}key=${encodeURIComponent(alnabiyKey)}`;
      }
      setResultUrl(url);
      setJobMeta({
        jobId: data.jobId || data.generationId,
        sceneCount: data.sceneCount || nextScenes.length,
      });
      pushHistory({
        id: data.jobId || `movie_${Date.now()}`,
        kind: "text_to_movie",
        title: (data.analysis?.title || script).slice(0, 80),
        prompt: script,
        mediaUrl: data.resultUrl,
        durationSec,
        emotionMode,
        creditsCost: data.creditsCost || credits,
        provider: "script-pipeline",
        quality,
        receiptId: data.receiptId as string | undefined,
      });
      setProgressPercent(100);
      setRenderStage("completed");
      setPhase("done");
    } catch (e) {
      if (tickRef.current) window.clearInterval(tickRef.current);
      setError(e instanceof Error ? e.message : tr("error_generic"));
      setPhase("idle");
      setRenderStage("failed");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-nabi-muted">{tr("rate_movie")}</p>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <section className="w-full shrink-0 space-y-4 lg:w-[22rem] xl:w-[24rem]">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium text-nabi-ink">
              {tr("script_label")}
            </label>
            <span className="rounded-full border border-nabi-gold/25 bg-nabi-gold/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-nabi-gold">
              {tr("studio_engine_badge")}
            </span>
          </div>
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={enhanceScript}
              disabled={enhancing || isOffline}
              className="nabi-btn-ghost !py-1.5 !text-xs inline-flex items-center gap-1.5"
            >
              {enhancing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Wand2 size={14} />
              )}
              {tr("enhance_prompt")}
            </button>
          </div>
          <textarea
            className="nabi-input min-h-[220px] resize-y text-[13px] leading-relaxed"
            placeholder={tr("script_placeholder")}
            value={script}
            onChange={(e) => setScript(e.target.value)}
          />
          <p className="text-xs text-nabi-muted">{script.length}</p>

          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d.sec}
                type="button"
                onClick={() => setDurationSec(d.sec)}
                className={`nabi-select px-3 py-1 text-xs ${
                  durationSec === d.sec ? "nabi-select-on" : ""
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <InsufficientBalanceHint
            kind="text_to_movie"
            cost={credits}
            coins={coins}
            durationSec={durationSec}
            costOpts={{
              engine: "auto",
              quality,
              frameRate,
            }}
            durationCandidates={DURATIONS.map((d) => d.sec)}
            onSelectDuration={setDurationSec}
            onSelectQuality={(q) => setQuality(q as RenderQuality)}
            currentQuality={quality}
            storeLabel={tr("store")}
            tryDurationLabel={(sec, nc) =>
              tr("try_shorter_duration")
                .replace(
                  "{duration}",
                  sec < 60 ? `${sec}s` : `${Math.round(sec / 60)} min`
                )
                .replace("{cost}", String(nc))
            }
            tryQualityLabel={tr("try_quality_720p")}
            tr={tr}
          />

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={analyzeOnly}
              disabled={loading}
              className="nabi-btn-ghost"
            >
              {phase === "analyzing" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Scissors size={16} />
              )}
              {tr("split_scenes")}
            </button>
            <button
              type="button"
              onClick={runFullPipeline}
              disabled={loading || isOffline || coins < credits}
              className="nabi-btn-primary"
            >
              {phase === "pipeline" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Clapperboard size={16} />
              )}
              {tr("create_with_alnabiy")}
              <span className="mx-1.5 opacity-40">•</span>
              <span className="tabular-nums text-amber-200">
                {credits.toLocaleString()} NC
              </span>
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {error}
            </div>
          )}

          <StudioAccordion title={tr("studio_advanced")}>
            <div className="space-y-4">
              <ModelSwitcher
                quality={quality}
                frameRate={frameRate}
                onQuality={setQuality}
                onFrameRate={setFrameRate}
              />
              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-nabi-muted">
                  {tr("style")}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {STYLE_KEYS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStyle(s.id)}
                      className={`nabi-select w-full px-3 py-3 text-left text-sm ${
                        style === s.id ? "nabi-select-on" : ""
                      }`}
                    >
                      {tr(s.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
              <NcReceiptHistory variant="compact" />
            </div>
          </StudioAccordion>
        </section>

        <section className="min-w-0 flex-1 space-y-4">
          {loading && (
            <div className="nabi-card space-y-2">
              <p className="text-xs font-medium text-nabi-muted">
                {tr("script_pipeline_progress")}
              </p>
              <RenderProgress percent={progressPercent} stage={renderStage} />
            </div>
          )}
          <MediaViewer
            loading={phase === "pipeline"}
            videoUrl={resultUrl}
            progressPercent={progressPercent}
            renderStage={renderStage}
            generationId={jobMeta.jobId}
            mediaTitle={(script || "Al-Nabi Film").slice(0, 60)}
            providerLine={
              phase === "done"
                ? `${tr("studio_engine_badge")} · ${tr("film_ready")}`
                : undefined
            }
          />
        </section>
      </div>

      <section className="nabi-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/75">
              {tr("studio_audio_tts")}
            </p>
            <p className="mt-0.5 text-[11px] text-white/40">
              {tr("studio_voice_hint")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {EMOTION_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setEmotionMode(m.id)}
              className={`nabi-btn-ghost !px-3 !text-xs ${
                emotionMode === m.id ? "nabi-select-on" : ""
              }`}
            >
              {tr(`emotion_${m.id}`)}
            </button>
          ))}
        </div>
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
      </section>

      <EpisodeBoard
        scenes={scenes}
        sceneStatus={sceneStatus}
        activeIndex={activeScene}
        jobId={jobMeta.jobId}
      />

      <ViralHooksPanel
        videoUrl={resultUrl}
        scriptOrPrompt={script}
        emotionMode={emotionMode}
        durationSec={durationSec}
      />
    </div>
  );
}
