"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import type {
  FrameRate,
  ImageEngineId,
  RenderQuality,
  VideoEngineId,
} from "@/lib/ai/catalog";

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

function ScriptToMoviePageInner() {
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
  const [durationSec, setDurationSec] = useState(60);
  const [videoEngine, setVideoEngine] = useState<VideoEngineId>("kling-v2.5");
  const [imageEngine, setImageEngine] = useState<ImageEngineId>("flux-pro");
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
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, []);

  const credits = useMemo(
    () =>
      calculateMovieCredits(durationSec, {
        engine: videoEngine,
        quality,
        frameRate,
      }),
    [durationSec, videoEngine, quality, frameRate]
  );
  const minutes = Math.max(1, Math.ceil(durationSec / 60));
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
            engine: videoEngine,
            quality,
            frameRate,
            cameraMove: camera,
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
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{tr("scriptMovie")}</h1>
        <p className="text-sm text-nabi-muted">{tr("rate_movie")}</p>
      </div>

      <div className="nabi-card space-y-3">
        <ModelSwitcher
          media="video"
          compact
          videoEngine={videoEngine}
          imageEngine={imageEngine}
          quality={quality}
          frameRate={frameRate}
          camera={camera}
          onVideoEngine={setVideoEngine}
          onImageEngine={setImageEngine}
          onQuality={setQuality}
          onFrameRate={setFrameRate}
          onCamera={setCamera}
        />
      </div>

      <div className="nabi-card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <label className="text-sm font-medium text-nabi-muted">
            {tr("script_label")}
          </label>
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
          className="nabi-input min-h-[220px] resize-y font-mono text-[13px] leading-relaxed"
          placeholder={tr("script_placeholder")}
          value={script}
          onChange={(e) => setScript(e.target.value)}
        />
        <p className="text-xs text-zinc-400">{script.length}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="nabi-card space-y-3">
          <p className="text-xs uppercase tracking-wider text-zinc-500">
            {tr("style")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {STYLE_KEYS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyle(s.id)}
                className={`rounded-xl border px-3 py-3 text-left text-sm transition-all duration-300 ease-apple hover:scale-[1.02] ${
                  style === s.id
                    ? "border-nabi-neon bg-cyan-500/10 text-nabi-neon"
                    : "border-nabi-border text-nabi-muted"
                }`}
              >
                {tr(s.labelKey)}
              </button>
            ))}
          </div>

          <p className="text-xs uppercase tracking-wider text-zinc-500">
            {tr("emotion_mode")}
          </p>
          <div className="flex flex-wrap gap-2">
            {EMOTION_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setEmotionMode(m.id)}
                className={`nabi-btn-ghost !px-3 !text-xs ${
                  emotionMode === m.id
                    ? "!border-fuchsia-400 !text-fuchsia-300"
                    : ""
                }`}
              >
                {tr(`emotion_${m.id}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="nabi-card space-y-3">
          <p className="text-xs uppercase tracking-wider text-zinc-500">
            {tr("duration_label")}
          </p>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d.sec}
                type="button"
                onClick={() => setDurationSec(d.sec)}
                className={`nabi-btn-ghost !px-3 ${
                  durationSec === d.sec
                    ? "!border-nabi-gold !text-nabi-gold"
                    : ""
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-nabi-gold">
              {tr("credit_calculator")}
            </p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-nabi-muted">
                <span>{tr("minutes_label")}</span>
                <span>{minutes} min</span>
              </div>
              <div className="flex justify-between text-nabi-muted">
                <span>{tr("rate_label")}</span>
                <span>{CREDIT_RATES.text_to_movie_per_min} / min</span>
              </div>
              <div className="flex justify-between border-t border-amber-500/20 pt-2 font-bold text-nabi-gold">
                <span>{tr("total_label")}</span>
                <span>{formatCredits(credits)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

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
          disabled={loading || isOffline}
          className="nabi-btn-primary"
        >
          {phase === "pipeline" ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Clapperboard size={16} />
          )}
          {tr("create_with_alnabiy")}
        </button>
      </div>

      {loading && (
        <div className="nabi-card space-y-2">
          <p className="text-xs font-medium text-nabi-muted">
            {tr("script_pipeline_progress")}
          </p>
          <RenderProgress percent={progressPercent} stage={renderStage} />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      <EpisodeBoard
        scenes={scenes}
        sceneStatus={sceneStatus}
        activeIndex={activeScene}
        jobId={jobMeta.jobId}
      />

      <MediaViewer
        loading={phase === "pipeline"}
        videoUrl={resultUrl}
        progressPercent={progressPercent}
        renderStage={renderStage}
        generationId={jobMeta.jobId}
        mediaTitle={(script || "Al-Nabi Film").slice(0, 60)}
        providerLine={
          phase === "done"
            ? `${tr(`emotion_${emotionMode}`)} · ${tr("film_ready")}`
            : undefined
        }
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

export default function ScriptToMoviePage() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-500">Loading…</div>}>
      <ScriptToMoviePageInner />
    </Suspense>
  );
}
