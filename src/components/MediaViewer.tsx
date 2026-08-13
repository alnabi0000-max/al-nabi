"use client";

import { DualPreview } from "@/components/DualPreview";
import { SecurePlayer } from "@/components/SecurePlayer";
import { SecureStill } from "@/components/SecureStill";
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
          <span className="inline-flex items-center gap-1.5 text-[11px] text-nabi-neon">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pink-400" />
            {t("render_in_progress")}
          </span>
        )}
      </div>

      {loading && (
        <div className="space-y-3">
          <div className="nabi-neon-frame aspect-video">
            <div className="absolute inset-[2px] flex flex-col items-center justify-center gap-4 rounded-[14px] bg-nabi-bg/90 p-6">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[var(--accent-from)]/30 via-[var(--accent-via)]/20 to-[var(--accent-to)]/30 blur-sm" />
              <div className="absolute h-10 w-10 animate-pulse rounded-full bg-gradient-to-r from-[var(--accent-from)] via-[var(--accent-via)] to-[var(--accent-to)] opacity-80" />
              <p className="relative z-10 mt-14 text-center text-xs text-nabi-muted">
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
            <SecureStill src={imageUrl} alt="Generated result" />
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
            <p className="py-10 text-center text-xs text-nabi-muted">
              {t("media_viewer_empty")}
            </p>
          )}
          {hasMedia && (
            <p className="text-[10px] text-nabi-muted">
              {t("preview_secure_hint")}
            </p>
          )}
          {providerLine && (
            <p className="text-[10px] text-nabi-muted">{providerLine}</p>
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
