"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  ImageIcon,
  Loader2,
  MoveHorizontal,
  Sparkles,
  Video,
  ZoomIn,
} from "lucide-react";
import { motion } from "framer-motion";
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
import { BgmPicker } from "@/components/BgmPicker";
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
    identityLocked,
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
        title: "Template yuklandi",
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
            message: "Template yuklanmadi — qayta urinib ko'ring",
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

  const cost = useMemo(
    () =>
      calculateGenerationCost(generationKind, duration, {
        engine: mediaKind === "image" ? imageEngine : videoEngine,
        quality,
        frameRate: mediaKind === "video" ? frameRate : undefined,
      }),
    [
      generationKind,
      duration,
      mediaKind,
      imageEngine,
      videoEngine,
      quality,
      frameRate,
    ]
  );

  function showApiError(e: unknown) {
    const message = friendlyApiError(e, tr);
    setError(message);
    notify({ message, type: "error", title: tr("error_generic") });
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
      title: "Template",
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
      const finalPrompt = composeTemplatePrompt(prompted, templateBasePrompt);
      const res = await fetchWithTimeout(
        "/api/generate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            prompt: finalPrompt,
            style,
            imageUrl: sourceImageUrl || undefined,
            cameraMove,
            durationSec: mediaKind === "image" ? 1 : duration,
            aspect,
            quality,
            frameRate,
            autoEnhance: false,
            identityLocked,
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
          durationSec: duration,
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
    <div key={locale} className="space-y-5 rounded-3xl bg-[#09090B] p-3 md:p-5">
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
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition",
                  mediaKind === "video"
                    ? "border-cyan-400/70 bg-cyan-400/10 text-white shadow-[0_0_16px_rgba(34,211,238,0.25)]"
                    : "border-white/10 text-white/50 hover:border-white/25"
                )}
              >
                <Video size={12} />
                Video
              </button>
              <button
                type="button"
                onClick={() => setMediaKind("image")}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition",
                  mediaKind === "image"
                    ? "border-cyan-400/70 bg-cyan-400/10 text-white shadow-[0_0_16px_rgba(34,211,238,0.25)]"
                    : "border-white/10 text-white/50 hover:border-white/25"
                )}
              >
                <ImageIcon size={12} />
                Image
              </button>
            </div>

            <textarea
              id="studio-prompt"
              className="min-h-[160px] w-full resize-y rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-base leading-relaxed text-white placeholder:text-white/30 focus:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
              placeholder={tr("prompt_placeholder")}
              value={prompt}
              maxLength={2000}
              onChange={(e) => setPrompt(e.target.value)}
              aria-label={tr("prompt_label")}
            />

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
              <div className="flex flex-wrap gap-2">
                {[5, 10, 15].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={clsx(
                      "rounded-full border px-3 py-1 text-xs transition",
                      duration === d
                        ? "border-white/40 bg-white/10 text-white"
                        : "border-white/10 text-white/45 hover:border-white/25"
                    )}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            )}
          </GlassCard>

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
                      "rounded-lg border px-2.5 py-1 text-[11px] transition",
                      cameraMove === c.id
                        ? "border-cyan-400/70 bg-cyan-400/10 text-white"
                        : "border-white/10 text-white/50 hover:border-white/25"
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
                      "rounded-full border px-2.5 py-1 text-[11px] transition",
                      emotionMode === m.id
                        ? "border-fuchsia-400/60 bg-fuchsia-500/10 text-white"
                        : "border-white/10 text-white/45 hover:border-white/25"
                    )}
                  >
                    {tr(`emotion_${m.id}`)}
                  </button>
                ))}
              </div>
              {mediaKind === "video" && (
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
              )}
              <p className="text-[11px] text-white/35">{tr("studio_tts_hint")}</p>
            </div>
          </StudioAccordion>

          <StudioAccordion title={tr("studio_advanced")} defaultOpen={showAdvanced}>
            <div className="space-y-4">
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
                        "rounded-full border px-3 py-1.5 text-xs transition",
                        active
                          ? "border-white/40 bg-white/10 text-white"
                          : "border-white/10 text-white/50 hover:border-white/25"
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
            durationSec={duration}
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

          <motion.button
            type="button"
            onClick={generate}
            disabled={loading || !prompt.trim() || isOffline || coins < cost}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-amber-400 px-5 py-3.5 text-sm font-semibold text-black shadow-[0_0_28px_rgba(34,211,238,0.28)] transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            {mediaKind === "image" ? tr("studio_create") : tr("studio_generate_video")}
            <span className="rounded-full bg-black/25 px-2.5 py-0.5 font-mono text-xs tabular-nums">
              {formatCredits(cost)}
            </span>
          </motion.button>

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

