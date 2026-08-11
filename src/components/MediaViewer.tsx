"use client";

import { DualPreview } from "@/components/DualPreview";
import { SecurePlayer } from "@/components/SecurePlayer";
import { RenderProgress } from "@/components/RenderProgress";
import { MediaActions } from "@/components/MediaActions";
import { useTranslations } from "@/lib/i18n/useTranslations";
import type { RenderStage } from "@/lib/generation/progress";
import clsx from "clsx";

type Props = {
  loading: boolean;
  imageUrl?: string | null;
  videoUrl?: string | null;
  videoUrlB?: string | null;
  activePreview?: "A" | "B";
  onSelectPreview?: (v: "A" | "B") => void;
  providerLine?: string;
  className?: string;
  progressPercent?: number;
  renderStage?: RenderStage;
  generationId?: string | null;
  r2Key?: string | null;
  showActions?: boolean;
  mediaTitle?: string;
};

/**
 * Cinema preview — neon pulse while generating
 */
export function MediaViewer({
  loading,
  imageUrl,
  videoUrl,
  videoUrlB,
  activePreview = "A",
  onSelectPreview,
  providerLine,
  className,
  progressPercent,
  renderStage,
  generationId,
  r2Key,
  showActions = true,
  mediaTitle,
}: Props) {
  const { t } = useTranslations();
  const hasMedia = Boolean(imageUrl || videoUrl);
  const pct =
    typeof progressPercent === "number"
      ? progressPercent
      : loading
        ? 35
        : hasMedia
          ? 100
          : 0;
  const stage: RenderStage =
    renderStage ||
    (loading ? "video" : hasMedia ? "completed" : "queued");

  const activeUrl =
    imageUrl ||
    (activePreview === "B" ? videoUrlB : videoUrl) ||
    videoUrl;

  return (
    <section
      id="media-viewer"
      className={clsx("nabi-card scroll-mt-24 space-y-3", className)}
      aria-busy={loading}
      aria-label={t("media_viewer_label")}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-nabi-muted">
          {t("preview_secure_title")}
        </h2>
        {loading && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-purple-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pink-400" />
            {t("render_in_progress")}
          </span>
        )}
      </div>

      {loading && (
        <div className="space-y-3">
          <div className="nabi-neon-frame aspect-video">
            <div className="absolute inset-[2px] flex flex-col items-center justify-center gap-4 rounded-[14px] bg-[#090A0F]/90 p-6">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-indigo-500/30 via-purple-500/20 to-pink-500/30 blur-sm" />
              <div className="absolute h-10 w-10 animate-pulse rounded-full bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 opacity-80" />
              <p className="relative z-10 mt-14 text-center text-xs text-zinc-400">
                {t("render_skeleton_hint")}
              </p>
              <div className="relative z-10 w-full max-w-sm">
                <RenderProgress percent={pct} stage={stage} />
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <>
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="Generated result"
              className="w-full rounded-xl border border-white/10"
            />
          ) : videoUrl && !videoUrlB ? (
            <SecurePlayer src={videoUrl} autoPlay muted />
          ) : hasMedia ? (
            <DualPreview
              srcA={videoUrl}
              srcB={videoUrlB}
              active={activePreview}
              onSelect={onSelectPreview}
              autoPlay
            />
          ) : (
            <p className="py-10 text-center text-xs text-zinc-400">
              {t("media_viewer_empty")}
            </p>
          )}
          {providerLine && (
            <p className="text-[10px] text-zinc-500">{providerLine}</p>
          )}
          {showActions && hasMedia && (
            <MediaActions
              mediaUrl={activeUrl}
              generationId={generationId}
              r2Key={r2Key}
              kind={imageUrl ? "image" : "video"}
              title={mediaTitle}
            />
          )}
        </>
      )}
    </section>
  );
}

export { scrollToMediaViewer } from "@/lib/media-viewer-scroll";
