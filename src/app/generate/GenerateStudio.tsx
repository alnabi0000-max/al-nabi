"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { ImageIcon, MoveHorizontal, Video, ZoomIn } from "lucide-react";
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
import { StudioGenerateCta } from "@/components/studio/StudioGenerateCta";
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
  IMAGE_MODEL_CARDS,
  VIDEO_MODEL_CARDS,
  isVideoEngineId,
  type FrameRate,
  type ImageEngineId,
  type RenderQuality,
  type VideoEngineId,
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

const STUDIO_VIDEO_IDS: VideoEngineId[] = [
  "kling-v2.5",
  "luma-ray2",
  "kling-v3",
  "auto",
];

const STUDIO_IMAGE_IDS: ImageEngineId[] = ["flux-pro", "sd3.5-large", "auto"];

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
  const [videoEngine, setVideoEngine] = useState<VideoEngineId>("kling-v2.5");
  const [imageEngine, setImageEngine] = useState<ImageEngineId>("flux-pro");
  const [aspect, setAspect] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [cameraMove, setCameraMove] = useState<CameraMovement>("static");
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [templateBasePrompt, setTemplateBasePrompt] = useState("");
  const [duration, setDuration] = useState(10);
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [renderStage, setRenderStage] = useState<
    import("@/lib/generation/progress").RenderStage
  >("queued");
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [r2Key, setR2Key] = useState<string | null>(null);
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
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
      if (isVideoEngineId(transfer.videoEngine)) {
        setVideoEngine(transfer.videoEngine);
      }
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
          setVideoEngine(resolved.videoEngine);
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

  const modelCards = useMemo(() => {
    if (mediaKind === "image") {
      return IMAGE_MODEL_CARDS.filter((c) =>
        STUDIO_IMAGE_IDS.includes(c.id as ImageEngineId)
      );
    }
    return VIDEO_MODEL_CARDS.filter((c) =>
      STUDIO_VIDEO_IDS.includes(c.id as VideoEngineId)
    );
  }, [mediaKind]);

  const selectedEngine =
    mediaKind === "image" ? imageEngine : videoEngine;

  const generationKind =
    mediaKind === "image" ? "image" : ("prompt_to_video" as const);

  const requestDuration =
    mediaKind === "video" && proMode && draftMode
      ? DRAFT_PREVIEW_SEC
      : duration;

  const cost = useMemo(
    () =>
      calculateGenerationCost(generationKind, requestDuration, {
        engine: mediaKind === "image" ? imageEngine : videoEngine,
        quality,
        frameRate: mediaKind === "video" ? frameRate : undefined,
      }),
    [
      generationKind,
      requestDuration,
      mediaKind,
      imageEngine,
      videoEngine,
      quality,
      frameRate,
    ]
  );

  const sessionCost = mediaKind === "video" ? cost + audioNc : cost;

  const seekTimeline = useCallback((sec: number) => {
    setPlayheadSec(sec);
    setSeekRequest((prev) => ({
      token: (prev?.token ?? 0) + 1,
      time: sec,
    }));
  }, []);

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
        throw new Error(String(data.error || tr("generate_failed")));
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
        throw new Error(String(data.error || tr("generate_failed")));
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
    setVideoEngine(resolved.videoEngine);
    setCameraMove(resolved.cameraMove);
    setPrompt(fillTemplatePrompt(template, template.subject_placeholder || ""));
    notify({
      message: `${template.title} · ${resolved.publicModelLabel}`,
      type: "success",
      title: tr("templates"),
    });
  }

  async function generate() {
    if (!prompt.trim() || isOffline) return;
    if (lowDataMode && !shouldBypassLowDataMode()) return;
    if (scanHalol(prompt).blocked) {
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
            engine: mediaKind === "image" ? imageEngine : videoEngine,
            imageEngine,
            templateId: templateId ?? undefined,
          }),
        },
        30_000
      );
      let data: Record<string, unknown>;
      try {
        data = await parseApiResponse<Record<string, unknown>>(res);
      } catch (parseErr) {
        if (res.status === 402) {
          applyServerCharge({ ok: false, code: "INSUFFICIENT" });
          return;
        }
        throw parseErr;
      }
      if (res.status === 402 || data.code === "INSUFFICIENT") {
        applyServerCharge({ ok: false, code: "INSUFFICIENT" });
        return;
      }
      if (!res.ok || data.ok === false || data.status === "FAILED") {
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
        setRenderStage("failed");
        throw new Error(String(data.error || tr("generate_failed")));
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
      applyServerCharge({
        ok: true,
        cost:
          data.creditsPending || !data.creditsCost
            ? undefined
            : (data.creditsCost as number | undefined),
        balanceAfter: data.balanceAfter as number | undefined,
        receiptId: data.receiptId as string | undefined,
        label: tr("create_with_alnabiy"),
        kind: generationKind,
      });

      const gid = (data.generationId || data.jobId) as string | undefined;
      if (gid) setGenerationId(gid);

      let resultUrl = (data.resultUrl || data.videoUrl || data.imageUrl) as
        | string
        | undefined;

      const sessionKey = key || alnabiyKey || null;

      const alreadyDone = Boolean(
        data.done || data.status === "COMPLETED" || resultUrl
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
          alnabiyKey: sessionKey,
          timeoutMs: 120_000,
          onUpdate: (p) => {
            if (typeof p.percent === "number") setProgressPercent(p.percent);
            if (p.stage)
              setRenderStage(
                p.stage as import("@/lib/generation/progress").RenderStage
              );
          },
        });
        if (status.failed) {
          setRenderStage("failed");
          if (typeof status.balanceAfter === "number") {
            applyServerCharge({
              ok: true,
              balanceAfter: status.balanceAfter,
            });
          }
          throw new Error(
            status.errorMessage || status.error || tr("generate_failed")
          );
        }
        if (
          typeof status.creditsCost === "number" &&
          status.creditsCost > 0
        ) {
          applyServerCharge({
            ok: true,
            cost: status.creditsCost,
            balanceAfter:
              typeof status.balanceAfter === "number"
                ? status.balanceAfter
                : undefined,
            kind: generationKind,
          });
        }
        resultUrl =
          (status.resultUrl ||
            status.videoUrl ||
            status.imageUrl ||
            undefined) as string | undefined;
        if (status.r2Key) setR2Key(status.r2Key);
        setProgressPercent(100);
        setRenderStage("completed");
      }

      const toPlayableUrl = (u: string | null | undefined) => {
        if (!u) return null;
        if (!u.startsWith("/api/media/")) return u;
        if (!sessionKey) return u;
        if (u.includes("key=")) return u;
        const join = u.includes("?") ? "&" : "?";
        return `${u}${join}key=${encodeURIComponent(sessionKey)}`;
      };

      if (mediaKind === "image" || data.imageUrl) {
        const url = toPlayableUrl(resultUrl || (data.imageUrl as string));
        setResultImage(url);
        setVideoUrl(null);
        setProvider(String(data.provider || "Al-Nabi Studio"));
        pushHistory({
          id: (gid || data.jobId) as string,
          kind: "image",
          title: prompt.slice(0, 80),
          prompt,
          mediaUrl: url,
          durationSec: 0,
          emotionMode,
          creditsCost: (data.creditsCost as number) ?? cost,
          provider: data.provider as string,
          quality,
          receiptId: data.receiptId as string | undefined,
        });
      } else {
        const url = toPlayableUrl(resultUrl || (data.videoUrl as string));
        setVideoUrl(url);
        setResultImage(null);
        setProvider(String(data.provider || "Cinematic"));
        requestAnimationFrame(() => scrollToMediaViewer());
        pushHistory({
          id: (gid || data.jobId) as string,
          kind: "prompt_to_video",
          title: prompt.slice(0, 80),
          prompt,
          mediaUrl: url,
          durationSec: requestDuration,
          emotionMode,
          creditsCost: (data.creditsCost as number) ?? cost,
          provider: data.provider as string,
          quality,
          receiptId: data.receiptId as string | undefined,
        });
      }
    } catch (e) {
      showApiError(e);
      setRenderStage("failed");
    } finally {
      setLoading(false);
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

  const cameraChoices: Array<{ id: typeof cameraMove; label: string }> = [
    { id: "static", label: "Static" },
    { id: "pan_left", label: "Pan L" },
    { id: "pan_right", label: "Pan R" },
    { id: "zoom_in", label: "Zoom +" },
    { id: "zoom_out", label: "Zoom −" },
    { id: "tilt_up", label: "Tilt ↑" },
    { id: "tilt_down", label: "Tilt ↓" },
    { id: "orbit", label: "Orbit" },
    { id: "slow_mo", label: "Slow-mo" },
  ];

  return (
    <div key={locale} className="space-y-5 bg-transparent">
      {isOffline && (
        <div className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/50">
          {tr("offline")}
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="space-y-4">
          <GlassCard className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMediaKind("video")}
                className={clsx(
                  "nabi-select px-3 py-1.5 text-xs",
                  mediaKind === "video" && "nabi-select-on"
                )}
              >
                <Video size={12} />
                Video
              </button>
              <button
                type="button"
                onClick={() => setMediaKind("image")}
                className={clsx(
                  "nabi-select px-3 py-1.5 text-xs",
                  mediaKind === "image" && "nabi-select-on"
                )}
              >
                <ImageIcon size={12} />
                Image
              </button>
            </div>

            <textarea
              id="studio-prompt"
              className="nabi-input min-h-[160px] resize-y rounded-xl px-3 py-3 text-base leading-relaxed"
              placeholder={tr("prompt_placeholder")}
              value={prompt}
              maxLength={2000}
              onChange={(e) => setPrompt(e.target.value)}
              aria-label={tr("prompt_label")}
            />

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

            <AspectRatioPicker value={aspect} onChange={setAspect} />

            {mediaKind === "video" && (
              <QuickCameraButtons
                value={cameraMove}
                onChange={setCameraMove}
              />
            )}

            <ProModeToggle
              enabled={proMode}
              onChange={setProModePersisted}
              label={tr("studio_pro_mode")}
            />
          </GlassCard>

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

          <StudioAccordion title={tr("camera_motion")}>
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-[11px] text-white/40">
                <MoveHorizontal size={12} />
                <ZoomIn size={12} />
                Pan · Zoom · Tilt
              </p>
              <div className="flex flex-wrap gap-2">
                {cameraChoices.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCameraMove(c.id)}
                    className={clsx(
                      "nabi-select px-2.5 py-1 text-[11px]",
                      cameraMove === c.id && "nabi-select-on"
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </StudioAccordion>

          <StudioAccordion title={tr("studio_audio_tts")}>
            <div className="space-y-3">
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
              <p className="text-[11px] text-white/35">{tr("studio_tts_hint")}</p>
            </div>
          </StudioAccordion>

          <StudioAccordion title={tr("studio_advanced")} defaultOpen={showAdvanced}>
            <div className="space-y-4">
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
              <TemplatePicker selectedId={templateId} onSelect={applyTemplate} />
              <div className="flex flex-wrap gap-2">
                {modelCards.map((card) => {
                  const active = selectedEngine === card.id;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => {
                        if (mediaKind === "image") {
                          setImageEngine(card.id as ImageEngineId);
                        } else {
                          setVideoEngine(card.id as VideoEngineId);
                        }
                      }}
                      className={clsx(
                        "nabi-select px-3 py-1.5 text-xs",
                        active && "nabi-select-on"
                      )}
                    >
                      {card.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </StudioAccordion>

          <InsufficientBalanceHint
            kind={generationKind}
            cost={cost}
            coins={coins}
            durationSec={requestDuration}
            costOpts={{
              engine: selectedEngine,
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

          <StudioGenerateCta
            loading={loading}
            disabled={loading || !prompt.trim() || isOffline || coins < cost}
            label={
              mediaKind === "image"
                ? tr("studio_create")
                : draftMode && proMode
                  ? tr("studio_generate_draft")
                  : tr("studio_generate_video")
            }
            costLabel={
              mediaKind === "video" && audioNc > 0
                ? `${formatCredits(cost)} + ${audioNc} NC`
                : formatCredits(cost)
            }
            onClick={generate}
          />

          {error && <p className="text-sm text-rose-400">{error}</p>}
          {provider && hasOutput && (
            <p className="text-[11px] text-white/35">
              {provider} · {tr(`emotion_${emotionMode}`)}
            </p>
          )}

          <NcReceiptHistory variant="compact" />
        </section>

        <aside className="space-y-4 lg:sticky lg:top-24">
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
                    .replace("{video}", String(cost))
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
          {mediaKind === "video" && (
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
          )}
        </aside>
      </div>

      <RecentGenerationsReel
        title={tr("studio_recent")}
        activeId={generationId}
        onSelect={loadRecord}
      />
    </div>
  );
}

