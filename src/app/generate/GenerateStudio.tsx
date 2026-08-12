"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Clapperboard,
  Download,
  ImageIcon,
  LayoutTemplate,
  Loader2,
  Sparkles,
  Video,
} from "lucide-react";
import clsx from "clsx";
import { scrollToMediaViewer } from "@/lib/media-viewer-scroll";
import {
  calculateGenerationCost,
  EMOTION_MODES,
  type EmotionMode,
  type StyleKey,
} from "@/lib/credits";
import { InsufficientBalanceHint } from "@/components/InsufficientBalanceHint";
import { friendlyApiError, parseApiResponse } from "@/lib/api-errors";
import { fetchWithTimeout } from "@/lib/api/fetch-timeout";
import { pushHistory } from "@/lib/generation-history";
import { scanHalol } from "@/lib/halol";
import { useMaster } from "@/context/MasterControllerContext";
import { shouldBypassLowDataMode } from "@/lib/security/client-mode";
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

const MediaViewer = dynamic(
  () =>
    import("@/components/MediaViewer").then((m) => ({ default: m.MediaViewer })),
  { ssr: false }
);

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

const VideoShowcasePanel = dynamic(
  () =>
    import("@/components/VideoShowcasePanel").then((m) => ({
      default: m.VideoShowcasePanel,
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
  const [style] = useState<StyleKey>("cinematic");
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
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const hydratedFromUrl = useRef(false);

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
      const finalPrompt = composeTemplatePrompt(prompt, templateBasePrompt);
      const res = await fetchWithTimeout(
        "/api/generate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            prompt: finalPrompt,
            style,
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
        });
      } else {
        const url = toPlayableUrl(resultUrl || (data.videoUrl as string));
        setVideoUrl(url);
        setResultImage(null);
        setProvider(String(data.provider || "Al-Nabi Cinematic"));
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

  return (
    <div key={locale} className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-nabi-muted">
            <Clapperboard size={12} />
            Studio Dashboard
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-nabi-ink md:text-3xl">
            Al-Nabi
          </h1>
          <p className="mt-1 max-w-lg text-sm text-nabi-muted">
            {tr("studio_subtitle")}
          </p>
        </div>
      </div>

      {isOffline && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
          {tr("offline")}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Left — inputs (below showcase on mobile) */}
        <section className="order-2 space-y-5 rounded-2xl border border-nabi-border bg-nabi-card p-5 md:p-6 lg:order-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wider text-nabi-muted">
              Featured templates
            </p>
            <Link
              href="/templates"
              className="inline-flex items-center gap-1.5 text-xs text-nabi-muted transition hover:text-nabi-ink"
            >
              <LayoutTemplate size={12} />
              500+ Explorer
            </Link>
          </div>
          <TemplatePicker selectedId={templateId} onSelect={applyTemplate} />

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-nabi-muted">
              Al-Nabi Models
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
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
                      "rounded-xl border px-3 py-2.5 text-left transition",
                      active
                        ? "border-nabi-neon/50 bg-nabi-elevated"
                        : "border-nabi-border bg-nabi-input hover:border-nabi-neon/35"
                    )}
                  >
                    <span className="block text-sm font-semibold text-nabi-ink">
                      {card.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-nabi-muted">
                      {card.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="studio-prompt"
              className="mb-2 block text-xs font-medium uppercase tracking-wider text-nabi-muted"
            >
              {tr("prompt_label")}
            </label>
            <textarea
              id="studio-prompt"
              className="nabi-input min-h-[140px] resize-y"
              placeholder={tr("prompt_placeholder")}
              value={prompt}
              maxLength={2000}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-nabi-muted">
              Aspect Ratio
            </p>
            <div className="flex flex-wrap gap-2">
              {(["16:9", "9:16", "1:1"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAspect(a)}
                  className={clsx(
                    "rounded-lg border px-3 py-1.5 text-sm transition",
                    aspect === a
                      ? "border-nabi-neon/50 bg-nabi-elevated text-nabi-ink"
                      : "border-nabi-border text-nabi-muted hover:border-nabi-neon/35"
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-nabi-muted">
              Media
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMediaKind("video")}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition",
                  mediaKind === "video"
                    ? "border-nabi-neon/50 bg-nabi-elevated text-nabi-ink"
                    : "border-nabi-border text-nabi-muted hover:border-nabi-neon/35"
                )}
              >
                <Video size={14} />
                Video
              </button>
              <button
                type="button"
                onClick={() => setMediaKind("image")}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition",
                  mediaKind === "image"
                    ? "border-nabi-neon/50 bg-nabi-elevated text-nabi-ink"
                    : "border-nabi-border text-nabi-muted hover:border-nabi-neon/35"
                )}
              >
                <ImageIcon size={14} />
                Image
              </button>
            </div>
          </div>

          {mediaKind === "video" && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-nabi-muted">
                Duration
              </p>
              <div className="flex flex-wrap gap-2">
                {[5, 10, 15].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={clsx(
                      "rounded-lg border px-3 py-1.5 text-sm transition",
                      duration === d
                        ? "border-nabi-neon/50 bg-nabi-elevated text-nabi-ink"
                        : "border-nabi-border text-nabi-muted hover:border-nabi-neon/35"
                    )}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>
          )}

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

          <button
            type="button"
            onClick={generate}
            disabled={loading || !prompt.trim() || isOffline || coins < cost}
            className="nabi-btn-primary w-full justify-center py-3"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            <span>
              Al-Nabi AI orqali Yaratish
              <span className="mx-1.5 opacity-40">•</span>
              <span className="tabular-nums text-amber-200">
                {cost.toLocaleString()} NC
              </span>
            </span>
          </button>

          {error && <p className="text-sm text-rose-400">{error}</p>}
        </section>

        {/* Right — showcase / preview (first on mobile for first impression) */}
        <aside className="order-1 space-y-4 lg:sticky lg:top-20 lg:order-2 lg:h-fit">
          {(hasOutput || loading) && (
            <MediaViewer
              loading={loading}
              imageUrl={resultImage}
              videoUrl={videoUrl}
              progressPercent={progressPercent}
              renderStage={renderStage}
              generationId={generationId}
              r2Key={r2Key}
              mediaTitle={prompt.slice(0, 60)}
              showActions={false}
              providerLine={
                provider
                  ? `${provider} · ${tr(`emotion_${emotionMode}`)}`
                  : undefined
              }
              className="!border-nabi-border"
            />
          )}

          {hasOutput && (
            <div className="rounded-2xl border border-nabi-border bg-nabi-card p-4">
              <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-nabi-muted">
                <Download size={12} />
                Download
              </p>
              <MediaActions
                mediaUrl={videoUrl || resultImage}
                generationId={generationId}
                r2Key={r2Key}
                kind={resultImage ? "image" : "video"}
                title={prompt.slice(0, 60) || "Al-Nabi"}
                archiveFee={false}
              />
            </div>
          )}

          {!hasOutput && !loading && (
            <VideoShowcasePanel />
          )}
        </aside>
      </div>
    </div>
  );
}

