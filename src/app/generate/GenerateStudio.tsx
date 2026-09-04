"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { ImageIcon, Video } from "lucide-react";
import clsx from "clsx";
import { scrollToMediaViewer } from "@/lib/media-viewer-scroll";
import {
  calculateGenerationCost,
  EMOTION_MODES,
  formatCredits,
  type EmotionMode,
} from "@/lib/credits";
import { InsufficientBalanceHint } from "@/components/InsufficientBalanceHint";
import { friendlyApiError, parseApiResponse } from "@/lib/api-errors";
import { fetchWithTimeout } from "@/lib/api/fetch-timeout";
import {
  pushHistory,
  removeHistoryItem,
  type GenerationRecord,
} from "@/lib/generation-history";
import { scanHalol } from "@/lib/halol";
import { useMaster } from "@/context/MasterControllerContext";
import { shouldBypassLowDataMode } from "@/lib/security/client-mode";
import {
  AspectRatioPicker,
  CINEMA_GLASS,
  GlassCard,
  StudioAccordion,
  StylePresets,
  styleFromPreset,
  vintageHint,
  type StylePresetId,
} from "@/components/studio/studio-primitives";
import { StudioDropzone } from "@/components/studio/StudioDropzone";
import { StudioPreviewCanvas } from "@/components/studio/StudioPreviewCanvas";
import { RecentGenerationsReel } from "@/components/studio/RecentGenerationsReel";
import { QuickCameraButtons } from "@/components/studio/QuickCameraButtons";
import { ProModeToggle } from "@/components/studio/ProModeToggle";
import { ProModePanel } from "@/components/studio/ProModePanel";
import { ProjectWorkflowPanel } from "@/components/studio/ProjectWorkflowPanel";
import { StudioGenerateCta } from "@/components/studio/StudioGenerateCta";
import { StudioGenerationConsent } from "@/components/studio/StudioGenerationConsent";
import { useStudioGenerationConsent } from "@/hooks/useStudioGenerationConsent";
import { StudioTimeline } from "@/components/studio/timeline";
import { decodeWaveformPeaks } from "@/components/studio/timeline/decode-waveform";
import type { TimelineClip } from "@/lib/studio/timeline";
import {
  composeProAwarePrompt,
  DEFAULT_LIGHTING,
  DRAFT_PREVIEW_SEC,
  EMPTY_KEYFRAMES,
  EMPTY_NEGATIVE_CANVAS,
  readStoredProMode,
  writeStoredProMode,
  type LightingJoystickValue,
  type NegativeCanvasValue,
  type StudioKeyframePair,
} from "@/lib/studio/pro-controls";
import {
  PUBLIC_RENDER_QUALITIES,
  type FrameRate,
  type RenderQuality,
} from "@/lib/ai/catalog";
import {
  composeTemplatePrompt,
  consumeTemplateTransfer,
  fillTemplatePrompt,
  resolveTemplatePreset,
} from "@/lib/templates/resolve";
import type { StudioTemplate } from "@/lib/templates/types";
import type { CameraMovement } from "@/lib/types";
import type { BgmMode } from "@/lib/bgm/types";
import { DEFAULT_BGM_SELECTION } from "@/lib/bgm/types";
import { useGenerationStatus } from "@/hooks/useGenerationStatus";
import {
  isSuccessfulGenerateResponse,
  type GenerateQueuedResponse,
} from "@/lib/generation/types";
import type { GenerationStatusPayload } from "@/lib/generation/poll";
import type { RenderStage } from "@/lib/generation/progress";
import {
  createPipelineTrace,
  localFallbackMedia,
  publicGenerationError,
  type PipelineLogEntry,
} from "@/lib/generation/pipeline";
import { StudioPipelineLog } from "@/components/studio/StudioPipelineLog";

const MediaActions = dynamic(
  () =>
    import("@/components/MediaActions").then((m) => ({
      default: m.MediaActions,
    })),
  { ssr: false }
);

const TemplatePicker = dynamic(
  () =>
    import("@/components/TemplatePicker").then((m) => ({
      default: m.TemplatePicker,
    })),
  { ssr: false }
);

const NcReceiptHistory = dynamic(
  () =>
    import("@/components/NcReceiptHistory").then((m) => ({
      default: m.NcReceiptHistory,
    })),
  { ssr: false }
);

const ALNABI_ENGINE = "auto" as const;

type RoutingEstimate = {
  configured: boolean;
  localMock?: boolean;
  effectiveDurationSec: number;
  durationAdjusted: boolean;
  estimatedCredits: number;
  expectedLatencySeconds: { p50: number; p90: number };
};

export default function GenerateStudio() {
  const {
    tr,
    locale,
    coins,
    alnabiyKey,
    applyServerCharge,
    setShowInsufficientModal,
    handleViolation,
    isOffline,
    lowDataMode,
    notify,
    ensureAuthSession,
  } = useMaster();
  const [prompt, setPrompt] = useState("");
  const [mediaKind, setMediaKind] = useState<"image" | "video">("video");
  const [emotionMode, setEmotionMode] = useState<EmotionMode>("epic");
  const [bgmMode, setBgmMode] = useState<BgmMode>(DEFAULT_BGM_SELECTION.mode);
  const [bgmTrackId, setBgmTrackId] = useState<string | null>(
    DEFAULT_BGM_SELECTION.trackId
  );
  const [stylePreset, setStylePreset] = useState<StylePresetId>("cinematic");
  const style = styleFromPreset(stylePreset);
  const [quality, setQuality] = useState<RenderQuality>("1080p");
  const [frameRate] = useState<FrameRate>(24);
  const [aspect, setAspect] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [cameraMove, setCameraMove] = useState<CameraMovement>("static");
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [templateBasePrompt, setTemplateBasePrompt] = useState("");
  const [duration, setDuration] = useState(15);
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pipelineLog, setPipelineLog] = useState<PipelineLogEntry[]>([]);
  const [provider, setProvider] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [renderStage, setRenderStage] = useState<
    import("@/lib/generation/progress").RenderStage
  >("queued");
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [r2Key, setR2Key] = useState<string | null>(null);
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [shotId, setShotId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const hydratedFromUrl = useRef(false);
  const [showAdvanced, setShowAdvanced] = useState(
    () => searchParams.get("templates") === "1"
  );
  const [proMode, setProMode] = useState(false);
  const [lighting, setLighting] =
    useState<LightingJoystickValue>(DEFAULT_LIGHTING);
  const [keyframes, setKeyframes] =
    useState<StudioKeyframePair>(EMPTY_KEYFRAMES);
  const [negativeCanvas, setNegativeCanvas] =
    useState<NegativeCanvasValue>(EMPTY_NEGATIVE_CANVAS);
  const [draftMode, setDraftMode] = useState(false);
  const [playheadSec, setPlayheadSec] = useState(0);
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const [seekRequest, setSeekRequest] = useState<{
    token: number;
    time: number;
  } | null>(null);
  const [audioNc, setAudioNc] = useState(0);
  const [routingEstimate, setRoutingEstimate] =
    useState<RoutingEstimate | null>(null);
  const [routingIssue, setRoutingIssue] = useState<string | null>(null);
  const generationConsent = useStudioGenerationConsent(alnabiyKey);

  useEffect(() => {
    setProMode(readStoredProMode());
  }, []);

  useEffect(() => {
    if (hydratedFromUrl.current) return;
    hydratedFromUrl.current = true;

    const transfer = consumeTemplateTransfer();
    if (transfer) {
      setTemplateId(transfer.templateId);
      setTemplateBasePrompt(transfer.basePrompt);
      setMediaKind("video");
      setAspect(transfer.aspect);
      setCameraMove(transfer.cameraMove);
      setPrompt(transfer.prompt);
      notify({
        message: transfer.title,
        type: "success",
        title: tr("template_loaded"),
      });
      return;
    }

    const params = new URLSearchParams(searchKey);
    const tid = parseInt(params.get("template") || "", 10);
    if (Number.isFinite(tid)) {
      import("@/lib/templates/catalog")
        .then(({ getStudioTemplate }) => {
          const tpl = getStudioTemplate(tid);
          if (!tpl) return;
          const resolved = resolveTemplatePreset(tpl);
          const subject = params.get("subject") || tpl.subject_placeholder || "";
          setTemplateId(tpl.id);
          setTemplateBasePrompt(resolved.basePrompt);
          setMediaKind("video");
          setAspect(resolved.aspect);
          setCameraMove(resolved.cameraMove);
          setPrompt(fillTemplatePrompt(tpl, subject));
        })
        .catch(() => {
          notify({
            message: tr("template_load_failed"),
            type: "error",
          });
        });
      return;
    }

    if (params.get("templates") === "1") setShowAdvanced(true);

    const qp = params.get("prompt");
    if (qp) setPrompt(qp);
    const kind = params.get("kind");
    if (kind === "image" || kind === "video") setMediaKind(kind);
    const emotion = params.get("emotion");
    if (emotion && EMOTION_MODES.some((m) => m.id === emotion)) {
      setEmotionMode(emotion as EmotionMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot URL/transfer hydrate
  }, [searchKey]);

  const generationKind =
    mediaKind === "image" ? "image" : ("prompt_to_video" as const);

  const requestDuration =
    mediaKind === "video" && proMode && draftMode
      ? DRAFT_PREVIEW_SEC
      : duration;

  useEffect(() => {
    if (mediaKind !== "video") {
      setRoutingEstimate(null);
      setRoutingIssue(null);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      engine: ALNABI_ENGINE,
      durationSec: String(requestDuration),
      aspect,
      quality,
      ...(sourceImageUrl || (proMode && keyframes.startUrl)
        ? { image: "1" }
        : {}),
      ...(proMode && keyframes.endUrl ? { endImage: "1" } : {}),
    });
    fetch(`/api/generation-capabilities?${params.toString()}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await response.json()) as {
          estimate?: RoutingEstimate;
          ok?: boolean;
          error?: string;
        };
        if (!response.ok || data.ok === false || !data.estimate) {
          throw new Error(data.error || "Routing estimate unavailable");
        }
        return data.estimate;
      })
      .then((estimate) => {
        setRoutingEstimate(estimate);
        setRoutingIssue(null);
      })
      .catch((estimateError) => {
        if (estimateError instanceof DOMException && estimateError.name === "AbortError") {
          return;
        }
        setRoutingEstimate(null);
        setRoutingIssue(
          estimateError instanceof Error
            ? estimateError.message
            : "Routing estimate unavailable"
        );
      });
    return () => controller.abort();
  }, [
    aspect,
    keyframes.endUrl,
    keyframes.startUrl,
    mediaKind,
    proMode,
    quality,
    requestDuration,
    sourceImageUrl,
  ]);

  const cost = useMemo(
    () =>
      calculateGenerationCost(generationKind, requestDuration, {
        engine: ALNABI_ENGINE,
        quality,
        frameRate: mediaKind === "video" ? frameRate : undefined,
      }),
    [
      generationKind,
      requestDuration,
      mediaKind,
      quality,
      frameRate,
    ]
  );

  const generationCost =
    mediaKind === "video" && routingEstimate
      ? routingEstimate.estimatedCredits
      : cost;
  const sessionCost =
    mediaKind === "video" ? generationCost + audioNc : generationCost;

  const seekTimeline = useCallback((sec: number) => {
    setPlayheadSec(sec);
    setSeekRequest((prev) => ({
      token: (prev?.token ?? 0) + 1,
      time: sec,
    }));
  }, []);

  const settledJobRef = useRef<string | null>(null);

  const appendPipeline = useCallback((entries?: PipelineLogEntry[]) => {
    if (!entries?.length) return;
    setPipelineLog((prev) => {
      const next = [...prev];
      for (const entry of entries) {
        const dup = next.some(
          (row) =>
            row.at === entry.at &&
            row.stage === entry.stage &&
            row.status === entry.status &&
            row.message === entry.message
        );
        if (!dup) next.push(entry);
      }
      return next.slice(-24);
    });
  }, []);

  const logStudioStep = useCallback(
    (
      stage: PipelineLogEntry["stage"],
      status: PipelineLogEntry["status"],
      message: string,
      code?: string
    ) => {
      const trace = createPipelineTrace(generationId || undefined);
      const entry =
        status === "error"
          ? trace.error(stage, message, code)
          : status === "recovered"
            ? trace.recovered(stage, message, code)
            : trace.ok(stage, message);
      setPipelineLog((prev) => [...prev, entry].slice(-24));
    },
    [generationId]
  );

  const applyFallbackPreview = useCallback(
    (reason: string, code?: string) => {
      const fallback = localFallbackMedia(
        mediaKind === "image" ? "image" : "video"
      );
      logStudioStep("player-render", "recovered", reason, code);
      if (mediaKind === "image") {
        setResultImage(fallback);
        setVideoUrl(null);
      } else {
        setVideoUrl(fallback);
        setResultImage(null);
      }
      setProgressPercent(100);
      setRenderStage("completed");
      setLoading(false);
    },
    [logStudioStep, mediaKind]
  );

  const applyLiveStatus = useCallback(
    (p: GenerationStatusPayload) => {
      if (typeof p.percent === "number") setProgressPercent(p.percent);
      if (p.stage) setRenderStage(p.stage as RenderStage);
      appendPipeline(p.pipelineLog);

      if (p.failed) {
        if (typeof p.balanceAfter === "number") {
          applyServerCharge({ ok: true, balanceAfter: p.balanceAfter });
        }
        const exact = publicGenerationError(p);
        setError(exact);
        applyFallbackPreview(
          exact,
          p.errorCode || p.pipelineStage || "PLAYER_RENDER_FAILED"
        );
        return;
      }

      if (!p.done && p.status !== "COMPLETED") return;

      const jobKey = p.generationId || p.jobId;
      if (jobKey && settledJobRef.current === jobKey) return;

      const rawUrl =
        p.resultUrl || p.videoUrl || p.imageUrl || p.fallbackUrl || null;
      const sessionKey = alnabiyKey;
      const playable =
        rawUrl &&
        rawUrl.startsWith("/api/media/") &&
        sessionKey &&
        !rawUrl.includes("key=")
          ? `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(sessionKey)}`
          : rawUrl;

      if (!playable) {
        const exact = publicGenerationError(p);
        setError(exact);
        applyFallbackPreview(exact || "Empty result URL", p.errorCode);
        return;
      }

      if (jobKey) settledJobRef.current = jobKey;

      if (p.r2Key) setR2Key(p.r2Key);
      if (p.provider) setProvider(p.provider);
      if (p.imageUrl || mediaKind === "image") {
        setResultImage(playable);
        setVideoUrl(null);
      } else {
        setVideoUrl(playable);
        setResultImage(null);
      }
      logStudioStep("player-render", "ok", "Preview attached");
      setProgressPercent(100);
      setRenderStage("completed");
      if (typeof p.creditsCost === "number" && p.creditsCost > 0) {
        applyServerCharge({
          ok: true,
          cost: p.creditsCost,
          balanceAfter:
            typeof p.balanceAfter === "number" ? p.balanceAfter : undefined,
          kind: generationKind,
        });
      }
      if (jobKey && playable) {
        pushHistory({
          id: jobKey,
          kind: mediaKind === "image" ? "image" : "prompt_to_video",
          title: prompt.slice(0, 80),
          prompt,
          mediaUrl: playable,
          durationSec: mediaKind === "image" ? 0 : requestDuration,
          emotionMode,
          creditsCost: p.creditsCost ?? generationCost,
          provider: p.provider || "Al-Nabi Studio",
          quality,
        });
      }
      setLoading(false);
    },
    [
      alnabiyKey,
      appendPipeline,
      applyFallbackPreview,
      applyServerCharge,
      emotionMode,
      generationCost,
      generationKind,
      logStudioStep,
      mediaKind,
      prompt,
      quality,
      requestDuration,
      tr,
    ]
  );

  useGenerationStatus({
    generationId,
    alnabiyKey,
    enabled: Boolean(generationId) && loading,
    timeoutMs: 300_000,
    onUpdate: applyLiveStatus,
  });

  function setProModePersisted(enabled: boolean) {
    setProMode(enabled);
    writeStoredProMode(enabled);
  }

  function showApiError(e: unknown) {
    const message = friendlyApiError(e, tr);
    setError(message);
    notify({ message, type: "error", title: tr("error_generic") });
  }

  function toPlayableAudio(
    url: string | undefined,
    base64: string | undefined,
    sessionKey: string | null
  ): string | null {
    if (base64) return `data:audio/mpeg;base64,${base64}`;
    if (!url) return null;
    if (!url.startsWith("/api/media/") || !sessionKey || url.includes("key=")) {
      return url;
    }
    const join = url.includes("?") ? "&" : "?";
    return `${url}${join}key=${encodeURIComponent(sessionKey)}`;
  }

  async function generateVoiceClip(
    clip: TimelineClip
  ): Promise<TimelineClip | null> {
    if (!clip.prompt.trim()) return null;
    if (scanHalol(clip.prompt).blocked) {
      handleViolation();
      return null;
    }
    try {
      const auth = await ensureAuthSession();
      const key = auth.alnabiyKey || alnabiyKey;
      const res = await fetchWithTimeout(
        "/api/audio/synthesize",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-alnabiy-key": key || "",
          },
          credentials: "include",
          body: JSON.stringify({
            text: clip.prompt,
            emotion: emotionMode,
            withDirector: false,
            clientBalance: coins,
          }),
        },
        45_000
      );
      const data = await parseApiResponse<Record<string, unknown>>(res);
      if (res.status === 402 || data.code === "INSUFFICIENT") {
        applyServerCharge({ ok: false, code: "INSUFFICIENT" });
        return null;
      }
      if (!res.ok || data.ok === false) {
        throw new Error(
          String(data.error || data.errorMessage || tr("generate_failed"))
        );
      }
      if (typeof data.creditsCost === "number" && data.creditsCost > 0) {
        applyServerCharge({
          ok: true,
          cost: data.creditsCost as number,
          balanceAfter: data.balanceAfter as number | undefined,
          receiptId: data.receiptId as string | undefined,
          label: tr("studio_tts_generate"),
        });
      }
      const audio = (data.audio || {}) as {
        url?: string;
        audioBase64?: string;
        durationMs?: number;
      };
      const audioUrl = toPlayableAudio(audio.url, audio.audioBase64, key);
      if (!audioUrl) return null;
      const durationSec = Math.max(
        0.4,
        (audio.durationMs || 0) / 1000 || clip.durationSec
      );
      const waveform = await decodeWaveformPeaks(audioUrl);
      notify({
        message: tr("studio_tts_generate"),
        type: "success",
      });
      return { ...clip, audioUrl, durationSec, waveform, generating: false };
    } catch (e) {
      showApiError(e);
      return null;
    }
  }

  async function generateSfxClip(
    clip: TimelineClip
  ): Promise<TimelineClip | null> {
    if (!clip.prompt.trim()) return null;
    if (scanHalol(clip.prompt).blocked) {
      handleViolation();
      return null;
    }
    try {
      const auth = await ensureAuthSession();
      const key = auth.alnabiyKey || alnabiyKey;
      const res = await fetchWithTimeout(
        "/api/audio/sfx",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-alnabiy-key": key || "",
          },
          credentials: "include",
          body: JSON.stringify({
            prompt: clip.prompt,
            durationSec: Math.min(4, clip.durationSec || 1.6),
            startSec: clip.startSec,
            clientBalance: coins,
          }),
        },
        45_000
      );
      const data = await parseApiResponse<Record<string, unknown>>(res);
      if (res.status === 402 || data.code === "INSUFFICIENT") {
        applyServerCharge({ ok: false, code: "INSUFFICIENT" });
        return null;
      }
      if (!res.ok || data.ok === false) {
        throw new Error(
          String(data.error || data.errorMessage || tr("generate_failed"))
        );
      }
      if (typeof data.creditsCost === "number" && data.creditsCost > 0) {
        applyServerCharge({
          ok: true,
          cost: data.creditsCost as number,
          balanceAfter: data.balanceAfter as number | undefined,
          receiptId: data.receiptId as string | undefined,
          label: tr("studio_sfx_generate"),
        });
      }
      const audio = (data.audio || {}) as {
        url?: string;
        audioBase64?: string;
        durationMs?: number;
      };
      const audioUrl = toPlayableAudio(audio.url, audio.audioBase64, key);
      if (!audioUrl) return null;
      const durationSec = Math.max(
        0.4,
        (audio.durationMs || 0) / 1000 || clip.durationSec
      );
      const waveform = await decodeWaveformPeaks(audioUrl);
      notify({
        message: tr("studio_sfx_generate"),
        type: "success",
      });
      return { ...clip, audioUrl, durationSec, waveform, generating: false };
    } catch (e) {
      showApiError(e);
      return null;
    }
  }

  function applyTemplate(template: StudioTemplate) {
    const resolved = resolveTemplatePreset(template);
    setTemplateId(template.id);
    setTemplateBasePrompt(resolved.basePrompt);
    setMediaKind("video");
    setAspect(resolved.aspect);
    setCameraMove(resolved.cameraMove);
    setPrompt(fillTemplatePrompt(template, template.subject_placeholder || ""));
    notify({
      message: template.title,
      type: "success",
      title: tr("templates"),
    });
  }

  async function generate() {
    if (!prompt.trim() || isOffline) return;
    if (!generationConsent.accepted) return;
    if (
      !generationConsent.ready &&
      !(await generationConsent.ensureRecorded())
    ) {
      return;
    }
    if (lowDataMode && !shouldBypassLowDataMode()) return;
    if (scanHalol(prompt).blocked) {
      handleViolation();
      return;
    }
    if (coins < generationCost) {
      setShowInsufficientModal(true);
      return;
    }

    setLoading(true);
    setError(null);
    setPipelineLog([]);
    setProgressPercent(8);
    setRenderStage("queued");
    logStudioStep("queue", "ok", "Studio generate requested");
    setGenerationId(null);
    setR2Key(null);
    settledJobRef.current = null;
    let keepWatching = false;
    requestAnimationFrame(() => scrollToMediaViewer());
    try {
      const auth = await ensureAuthSession();
      const key = auth.alnabiyKey || alnabiyKey;
      const hint = vintageHint(stylePreset);
      const prompted = hint ? `${prompt.trim()}. ${hint}` : prompt;
      const templated = composeTemplatePrompt(prompted, templateBasePrompt);
      const finalPrompt = composeProAwarePrompt({
        prompt: templated,
        proMode,
        lighting,
        hasEndKeyframe: Boolean(proMode && keyframes.endUrl),
        negativeStrokeCount: proMode ? negativeCanvas.strokeCount : 0,
      });
      const referenceImage =
        (proMode && keyframes.startUrl) || sourceImageUrl || undefined;
      const res = await fetchWithTimeout(
        "/api/generate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            prompt: finalPrompt,
            style,
            imageUrl: referenceImage,
            cameraMove,
            durationSec: mediaKind === "image" ? 1 : requestDuration,
            aspect,
            quality,
            frameRate,
            autoEnhance: false,
            emotionMode,
            locale,
            mediaKind: mediaKind === "image" ? "image" : "video",
            bgmMode: mediaKind === "video" ? bgmMode : "off",
            bgmTrackId: mediaKind === "video" ? bgmTrackId : null,
            alnabiyKey: key,
            clientBalance: coins,
            projectId: projectId || undefined,
            shotId: shotId || undefined,
            engine: ALNABI_ENGINE,
            imageEngine: ALNABI_ENGINE,
            templateId: templateId ?? undefined,
            endImageUrl:
              mediaKind === "video" && proMode && keyframes.endUrl
                ? keyframes.endUrl
                : undefined,
          }),
        },
        120_000
      );
      let data: GenerateQueuedResponse;
      try {
        data = await parseApiResponse<GenerateQueuedResponse>(res);
      } catch (parseErr) {
        if (res.status === 402) {
          applyServerCharge({ ok: false, code: "INSUFFICIENT" });
          return;
        }
        if (res.status === 428) {
          await generationConsent.ensureRecorded();
          return;
        }
        throw parseErr;
      }
      if (data.code === "CONSENT_REQUIRED") {
        await generationConsent.ensureRecorded();
        return;
      }
      if (res.status === 402 || data.code === "INSUFFICIENT") {
        applyServerCharge({ ok: false, code: "INSUFFICIENT" });
        return;
      }
      if (
        !isSuccessfulGenerateResponse(data) &&
        (!res.ok || data.ok === false || data.status === "FAILED")
      ) {
        /* /api/generate can return HTTP 200 with ok:false/status:FAILED
         * after charging + auto-refunding server-side — sync the
         * post-refund balance (never the stale pre-refund one) and
         * surface the failure instead of treating it as a success. */
        if (typeof data.balanceAfter === "number") {
          applyServerCharge({
            ok: true,
            balanceAfter: data.balanceAfter as number,
          });
        }
        appendPipeline(data.pipelineLog);
        const exact = publicGenerationError(data);
        setError(exact);
        notify({
          message: exact,
          type: "error",
          title: data.errorCode || data.pipelineStage || "GENERATION_FAILED",
        });
        applyFallbackPreview(
          exact,
          data.errorCode || data.pipelineStage || "PLAYER_RENDER_FAILED"
        );
        return;
      }
      if (data.alnabiyKey || data.alnabiy_key) {
        try {
          const { LS_KEY } = await import("@/lib/credits");
          localStorage.setItem(
            LS_KEY,
            String(data.alnabiyKey || data.alnabiy_key)
          );
        } catch {
          /* soft */
        }
      }
      appendPipeline(data.pipelineLog);
      logStudioStep(
        "queue",
        "ok",
        data.instantMock || data.queueMode === "sync"
          ? "Mock generate response received"
          : "Generate response received"
      );
      const gid = data.generationId || data.jobId;
      if (gid) setGenerationId(gid);
      if (data.projectId) setProjectId(data.projectId);
      if (data.shotId) setShotId(data.shotId);

      const alreadyDone = Boolean(
        data.done || data.status === "COMPLETED" || data.resultUrl
      );

      if (alreadyDone) {
        applyLiveStatus({
          ...data,
          done: true,
          status: data.status || "COMPLETED",
          stage: "completed",
          percent: 100,
        });
        return;
      }

      if (data.queued && gid) {
        applyServerCharge({
          ok: true,
          cost: data.creditsPending || !data.creditsCost
            ? undefined
            : data.creditsCost,
          balanceAfter: data.balanceAfter,
          receiptId: data.receiptId,
          label: tr("create_with_alnabiy"),
          kind: generationKind,
        });
        keepWatching = true;
        return;
      }

      throw new Error(publicGenerationError(data));
    } catch (e) {
      const raw = e instanceof Error ? e.message.trim() : "";
      const network =
        /failed to fetch|networkerror|load failed|econnreset|econnrefused/i.test(
          raw
        );
      const exact = network
        ? publicGenerationError({ errorCode: "NETWORK_RESET" })
        : raw || publicGenerationError({});
      setError(exact);
      notify({
        message: exact,
        type: "error",
        title: network ? "NETWORK_RESET" : "PLAYER_RENDER_FAILED",
      });
      applyFallbackPreview(
        exact,
        network ? "NETWORK_RESET" : "PLAYER_RENDER_FAILED"
      );
    } finally {
      if (!keepWatching) setLoading(false);
    }
  }

  const hasOutput = Boolean(videoUrl || resultImage);

  function loadRecord(record: GenerationRecord) {
    setPrompt(record.prompt || record.title);
    setGenerationId(record.id);
    setProvider(record.provider || "");
    if (record.kind === "image") {
      setResultImage(record.mediaUrl || null);
      setVideoUrl(null);
      setMediaKind("image");
    } else {
      setVideoUrl(record.mediaUrl || null);
      setResultImage(null);
      setMediaKind("video");
    }
  }

  function clearOutput() {
    if (generationId) removeHistoryItem(generationId);
    setVideoUrl(null);
    setResultImage(null);
    setGenerationId(null);
    setR2Key(null);
  }

  function upscaleAndGenerate() {
    if (quality === "4K" || quality === "8K") return;
    setQuality("4K");
    notify({ message: tr("studio_upscale_ready"), type: "info" });
  }

  return (
    <div key={locale} className="flex flex-col gap-5 bg-transparent">
      {isOffline && (
        <div className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/50">
          {tr("offline")}
        </div>
      )}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <section className="w-full shrink-0 space-y-4 lg:w-[22rem] xl:w-[24rem]">
          <GlassCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex rounded-full border border-white/10 bg-white/[0.03] p-0.5">
                <button
                  type="button"
                  onClick={() => setMediaKind("video")}
                  className={clsx(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                    mediaKind === "video"
                      ? "bg-white/10 text-white"
                      : "text-white/45 hover:text-white/80"
                  )}
                >
                  <Video size={12} />
                  Video
                </button>
                <button
                  type="button"
                  onClick={() => setMediaKind("image")}
                  className={clsx(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                    mediaKind === "image"
                      ? "bg-white/10 text-white"
                      : "text-white/45 hover:text-white/80"
                  )}
                >
                  <ImageIcon size={12} />
                  Image
                </button>
              </div>
              <span className="rounded-full border border-nabi-gold/25 bg-nabi-gold/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-nabi-gold">
                {tr("studio_engine_badge")}
              </span>
            </div>

            <textarea
              id="studio-prompt"
              className="nabi-input min-h-[180px] resize-y rounded-xl px-3 py-3 text-base leading-relaxed"
              placeholder={tr("prompt_placeholder")}
              value={prompt}
              maxLength={2000}
              onChange={(e) => setPrompt(e.target.value)}
              aria-label={tr("prompt_label")}
            />

            <AspectRatioPicker value={aspect} onChange={setAspect} variants="primary" />

            {mediaKind === "video" && (
              <div className="flex flex-wrap gap-2">
                {[5, 10, 15].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={clsx(
                      "nabi-select px-3 py-1 text-xs",
                      duration === d && "nabi-select-on"
                    )}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            )}
          </GlassCard>

          <InsufficientBalanceHint
            kind={generationKind}
            cost={generationCost}
            coins={coins}
            durationSec={requestDuration}
            costOpts={{
              engine: ALNABI_ENGINE,
              quality,
              frameRate: mediaKind === "video" ? frameRate : undefined,
            }}
            durationCandidates={[5, 10, 15]}
            onSelectDuration={setDuration}
            onSelectQuality={(q) => setQuality(q as RenderQuality)}
            currentQuality={quality}
            storeLabel={tr("store")}
            tryDurationLabel={(sec, nc) =>
              tr("try_shorter_duration")
                .replace("{duration}", `${sec}s`)
                .replace("{cost}", String(nc))
            }
            tryQualityLabel={tr("try_quality_720p")}
            tr={tr}
          />

          <StudioGenerationConsent
            accepted={generationConsent.accepted}
            recording={generationConsent.recording}
            persistError={generationConsent.persistError}
            onChange={(next) => {
              void generationConsent.setConsent(next);
            }}
            labels={{
              before: tr("studio_consent_label_before"),
              and: tr("studio_consent_label_and"),
              after: tr("studio_consent_label_after"),
              terms: tr("terms_of_service"),
              privacy: tr("privacy_policy"),
              ai: tr("studio_consent_ai"),
              helper: tr("studio_consent_helper"),
              saving: tr("studio_consent_saving"),
              saveFailed: tr("studio_consent_save_failed"),
            }}
          />

          <StudioGenerateCta
            loading={loading || generationConsent.recording}
            disabled={
              loading ||
              generationConsent.recording ||
              !generationConsent.accepted ||
              !prompt.trim() ||
              isOffline ||
              coins < generationCost ||
              (mediaKind === "video" &&
                !routingEstimate?.localMock &&
                (routingEstimate?.configured === false || Boolean(routingIssue)))
            }
            title={
              !generationConsent.accepted
                ? tr("studio_consent_helper")
                : generationConsent.persistError
                  ? tr("studio_consent_save_failed")
                  : undefined
            }
            label={
              mediaKind === "image"
                ? tr("studio_create")
                : draftMode && proMode
                  ? tr("studio_generate_draft")
                  : tr("studio_generate_video")
            }
            costLabel={
              mediaKind === "video" && audioNc > 0
                ? `${formatCredits(generationCost)} + ${audioNc} NC`
                : formatCredits(generationCost)
            }
            onClick={generate}
          />

          {mediaKind === "video" &&
            routingEstimate?.configured &&
            !routingEstimate.localMock && (
            <p className="text-[11px] text-white/40">
              {`~${routingEstimate.expectedLatencySeconds.p50}s typical`}
              {routingEstimate.durationAdjusted
                ? " · duration adjusted to the supported limit."
                : ""}
            </p>
          )}
          {mediaKind === "video" && routingEstimate?.localMock && (
            <p className="text-[11px] text-white/40">
              Instant local preview — provider keys are not required.
            </p>
          )}
          {mediaKind === "video" &&
            routingEstimate?.configured === false &&
            !routingEstimate.localMock && (
            <p className="text-[11px] text-amber-300">
              Video provider is not configured.
            </p>
          )}
          {mediaKind === "video" && routingIssue && !routingEstimate?.localMock && (
            <p className="text-[11px] text-amber-300">{routingIssue}</p>
          )}
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <StudioPipelineLog entries={pipelineLog} />

          <StudioAccordion title={tr("studio_advanced")} defaultOpen={showAdvanced}>
            <div className="space-y-4">
              {mediaKind === "video" && (
                <StudioDropzone
                  preview={sourceImageUrl}
                  onFile={(_f, dataUrl) => setSourceImageUrl(dataUrl)}
                  onClear={() => setSourceImageUrl(null)}
                  title={tr("drag_drop_zone")}
                  hint={tr("drag_drop_hint")}
                  tooLarge="Max 5MB"
                />
              )}
              <AspectRatioPicker value={aspect} onChange={setAspect} variants="all" />
              {mediaKind === "video" && (
                <QuickCameraButtons
                  value={cameraMove}
                  onChange={setCameraMove}
                />
              )}
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-wider text-white/40">
                  {tr("quality")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {PUBLIC_RENDER_QUALITIES.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuality(q)}
                      className={clsx(
                        "nabi-select px-3 py-1 text-xs",
                        quality === q && "nabi-select-on"
                      )}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
              <StylePresets
                value={stylePreset}
                onChange={setStylePreset}
                labels={{
                  cinematic: tr("studio_style_cinematic"),
                  photorealistic: tr("studio_style_photoreal"),
                  anime: tr("studio_style_anime"),
                  vintage: tr("studio_style_vintage"),
                }}
              />
              <ProModeToggle
                enabled={proMode}
                onChange={setProModePersisted}
                label={tr("studio_pro_mode")}
              />
              <TemplatePicker selectedId={templateId} onSelect={applyTemplate} />
              <NcReceiptHistory variant="compact" />
            </div>
          </StudioAccordion>

          <ProModePanel
            open={proMode}
            showVideoTools={mediaKind === "video"}
            lighting={lighting}
            onLightingChange={setLighting}
            keyframes={keyframes}
            onKeyframesChange={setKeyframes}
            canvas={negativeCanvas}
            onCanvasChange={setNegativeCanvas}
            canvasBackground={
              keyframes.startUrl || sourceImageUrl || resultImage
            }
            draftMode={draftMode}
            onDraftModeChange={setDraftMode}
            copy={{
              lightingTitle: tr("studio_pro_lighting"),
              lightingHint: tr("studio_pro_lighting_hint"),
              keyframeTitle: tr("studio_pro_keyframes"),
              keyframeStart: tr("studio_pro_keyframe_start"),
              keyframeEnd: tr("studio_pro_keyframe_end"),
              keyframeHint: tr("studio_pro_keyframe_hint"),
              tooLarge: "Max 5MB",
              canvasTitle: tr("studio_pro_canvas"),
              canvasHint: tr("studio_pro_canvas_hint"),
              canvasClear: tr("studio_pro_canvas_clear"),
              draftTitle: tr("studio_pro_draft"),
              draftHint: tr("studio_pro_draft_hint"),
            }}
          />

          <ProjectWorkflowPanel
            alnabiyKey={alnabiyKey}
            prompt={prompt}
            selectedProjectId={projectId}
            latestGenerationId={generationId}
            onProjectChange={setProjectId}
            onShotChange={setShotId}
            onUseShot={(shot) => {
              if (shot.prompt) setPrompt(shot.prompt);
              if (shot.aspect) setAspect(shot.aspect);
              if (shot.quality === "720p" || shot.quality === "1080p" || shot.quality === "4K") {
                setQuality(shot.quality);
              }
              if (shot.durationSec) setDuration(shot.durationSec);
            }}
          />
        </section>

        <section className="min-w-0 flex-1">
          <StudioPreviewCanvas
            loading={loading}
            imageUrl={resultImage}
            videoUrl={videoUrl}
            progressPercent={progressPercent}
            renderStage={renderStage}
            emptyLabel={tr("studio_canvas_empty")}
            aspect={aspect}
            onUpscale={upscaleAndGenerate}
            onDelete={clearOutput}
            upscaleDisabled={quality === "4K" || quality === "8K" || !hasOutput}
            seekRequest={seekRequest}
            onTimeChange={(t) => setPlayheadSec(t)}
            controlledPlaying={videoUrl ? timelinePlaying : undefined}
            onPlayingChange={setTimelinePlaying}
            creditBreakdown={
              mediaKind === "video"
                ? tr("studio_preview_nc")
                    .replace("{video}", String(generationCost))
                    .replace("{audio}", String(audioNc))
                    .replace("{total}", String(sessionCost))
                : null
            }
            labels={{
              upscale: tr("studio_upscale"),
              delete: tr("media_delete"),
            }}
            actions={
              hasOutput ? (
                <MediaActions
                  mediaUrl={videoUrl || resultImage}
                  generationId={generationId}
                  r2Key={r2Key}
                  kind={resultImage ? "image" : "video"}
                  title={prompt.slice(0, 60) || "Al-Nabi"}
                  archiveFee={false}
                  variant="icons"
                />
              ) : null
            }
          />
        </section>
      </div>

      {mediaKind === "video" && (
        <section className={clsx(CINEMA_GLASS, "space-y-4 p-4")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/75">
                {tr("studio_audio_tts")}
              </p>
              <p className="mt-0.5 text-[11px] text-white/40">
                {tr("studio_voice_hint")}
              </p>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-nabi-gold/80">
              {tr("studio_engine_badge")}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {EMOTION_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setEmotionMode(m.id)}
                className={clsx(
                  "nabi-select px-2.5 py-1 text-[11px]",
                  emotionMode === m.id && "nabi-select-on"
                )}
              >
                {tr(`emotion_${m.id}`)}
              </button>
            ))}
          </div>
          <StudioTimeline
            durationSec={duration}
            onDurationChange={setDuration}
            playheadSec={playheadSec}
            onSeek={setPlayheadSec}
            onScrub={seekTimeline}
            playing={timelinePlaying}
            onPlayingChange={setTimelinePlaying}
            bgmMode={bgmMode}
            bgmTrackId={bgmTrackId}
            onBgmModeChange={setBgmMode}
            onBgmTrackChange={setBgmTrackId}
            emotionMode={emotionMode}
            disabled={loading}
            externalClock={Boolean(videoUrl)}
            onAudioCostChange={setAudioNc}
            onGenerateVoice={generateVoiceClip}
            onGenerateSfx={generateSfxClip}
            copy={{
              title: tr("studio_timeline"),
              hint: tr("studio_timeline_hint"),
              frames: tr("studio_frames"),
              mute: tr("studio_mute"),
              unmute: tr("studio_unmute"),
              included: tr("studio_bgm_included"),
              voicePlaceholder: tr("studio_tts_placeholder"),
              sfxPlaceholder: tr("studio_sfx_placeholder"),
              generateVoice: tr("studio_tts_generate"),
              generateSfx: tr("studio_sfx_generate"),
              audioNc: tr("studio_audio_nc"),
              bgmTitle: tr("bgm_title"),
              bgmAi: tr("bgm_ai"),
              bgmManual: tr("bgm_manual"),
              bgmOff: tr("bgm_off"),
              bgmAiHint: tr("bgm_ai_hint"),
              bgmEmpty: tr("bgm_empty"),
              bgmLoading: tr("bgm_loading"),
            }}
          />
        </section>
      )}

      <RecentGenerationsReel
        title={tr("studio_recent")}
        activeId={generationId}
        onSelect={loadRecord}
      />
    </div>
  );
}
