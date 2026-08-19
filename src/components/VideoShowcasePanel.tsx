"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import clsx from "clsx";
import { useMaster } from "@/context/MasterControllerContext";
import {
  VIDEO_SHOWCASE_AUTOPLAY_MS,
  VIDEO_SHOWCASE_EXAMPLES,
  type VideoShowcaseExample,
} from "@/lib/video-showcase";

type Props = {
  className?: string;
  examples?: VideoShowcaseExample[];
  /** Tighter chrome for the split auth showcase card. */
  compact?: boolean;
};

/**
 * Marketing showcase — before/after slider + example carousel for /generate.
 */
export function VideoShowcasePanel({
  className,
  examples = VIDEO_SHOWCASE_EXAMPLES,
  compact = false,
}: Props) {
  const { tr } = useMaster();
  const [index, setIndex] = useState(0);
  const [split, setSplit] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);
  const pausedRef = useRef(false);
  const draggingRef = useRef(false);
  const count = examples.length;
  const active = examples[index] ?? examples[0];

  indexRef.current = index;
  pausedRef.current = paused;
  draggingRef.current = dragging;

  const go = useCallback(
    (next: number) => {
      if (count <= 0) return;
      setIndex(((next % count) + count) % count);
      setSplit(50);
    },
    [count]
  );

  useEffect(() => {
    if (count <= 1) return;
    const id = window.setInterval(() => {
      if (pausedRef.current || draggingRef.current) return;
      go(indexRef.current + 1);
    }, VIDEO_SHOWCASE_AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [count, go]);

  const updateSplit = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSplit(Math.min(92, Math.max(8, pct)));
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
    setPaused(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateSplit(e.clientX);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    updateSplit(e.clientX);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* soft */
    }
    window.setTimeout(() => setPaused(false), 4000);
  };

  if (!active || count === 0) return null;

  const hasBefore = Boolean(active.beforeImage);
  const afterStill = active.afterPoster || active.beforeImage;

  return (
    <section
      className={clsx(
        "overflow-hidden rounded-2xl border border-nabi-border bg-nabi-card",
        className
      )}
      aria-roledescription="carousel"
      aria-label={tr("video_showcase_title")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        if (!dragging) setPaused(false);
      }}
    >
      {compact ? null : (
        <header className="border-b border-nabi-border px-4 pb-3 pt-4 md:px-5">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-nabi-neon/15 text-nabi-neon">
              <Sparkles size={14} />
            </span>
            <div>
              <h2 className="font-display text-base font-semibold tracking-tight text-nabi-ink md:text-lg">
                {tr("video_showcase_title")}
              </h2>
              <p className="mt-0.5 text-xs leading-relaxed text-nabi-muted md:text-sm">
                {tr("video_showcase_subtitle")}
              </p>
            </div>
          </div>
        </header>
      )}

      <div className="relative px-3 pt-3 md:px-4">
        <div
          ref={trackRef}
          className="relative aspect-video touch-none select-none overflow-hidden rounded-xl border border-nabi-border bg-nabi-input"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="img"
          aria-label={tr(active.promptKey) || tr(active.titleKey)}
        >
          {/* After — full frame */}
          <div className="absolute inset-0">
            {active.afterVideo ? (
              <video
                key={active.afterVideo}
                src={active.afterVideo}
                poster={afterStill}
                className="h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
              />
            ) : afterStill ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={afterStill}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <PlaceholderSide
                label={tr("video_showcase_after")}
                hint={tr("video_showcase_placeholder")}
                tone="after"
              />
            )}
          </div>

          {/* Before — clipped via clip-path so media stays full-bleed */}
          <div
            className="absolute inset-0"
            style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
          >
            {hasBefore ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={active.beforeImage}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              <PlaceholderSide
                label={tr("video_showcase_before")}
                hint={tr("video_showcase_placeholder")}
                tone="before"
              />
            )}
          </div>

          {/* Divider */}
          <div
            className="absolute inset-y-0 z-10 w-px bg-white/80 shadow-[0_0_12px_rgba(167,139,250,0.55)]"
            style={{ left: `${split}%` }}
          >
            <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/70 text-white shadow-neon backdrop-blur-sm">
              <ChevronLeft size={14} className="-mr-0.5 opacity-80" />
              <ChevronRight size={14} className="-ml-0.5 opacity-80" />
            </span>
          </div>

          {/* Corner tags */}
          <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-nabi-ink backdrop-blur-sm">
            {tr("video_showcase_before")}
          </span>
          <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-nabi-neon/25 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-nabi-neon backdrop-blur-sm">
            {tr("video_showcase_after")}
          </span>

          {/* Prompt overlay */}
          {active.promptKey ? (
            <p className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-3 pt-10 text-xs leading-snug text-white/95 md:text-sm">
              “{tr(active.promptKey)}”
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-start justify-between gap-3 px-4 py-4 md:px-5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-nabi-ink">{tr(active.titleKey)}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-nabi-muted">
            {tr(active.promptKey)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setPaused(true);
              go(index - 1);
              window.setTimeout(() => setPaused(false), 4000);
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-nabi-border bg-nabi-input text-nabi-ink transition hover:border-nabi-gold/40 hover:text-nabi-ink"
            aria-label={tr("video_showcase_prev")}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              setPaused(true);
              go(index + 1);
              window.setTimeout(() => setPaused(false), 4000);
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-nabi-border bg-nabi-input text-nabi-ink transition hover:border-nabi-gold/40 hover:text-nabi-ink"
            aria-label={tr("video_showcase_next")}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div
        className="flex items-center justify-center gap-1.5 pb-4"
        role="tablist"
        aria-label={tr("video_showcase_title")}
      >
        {examples.map((ex, i) => (
          <button
            key={ex.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={tr(ex.titleKey)}
            onClick={() => {
              setPaused(true);
              go(i);
              window.setTimeout(() => setPaused(false), 4000);
            }}
            className={clsx(
              "h-1.5 rounded-full transition-all",
              i === index
                ? "w-5 bg-nabi-neon shadow-neon"
                : "w-1.5 bg-white/25 hover:bg-white/45"
            )}
          />
        ))}
      </div>
    </section>
  );
}

function PlaceholderSide({
  label,
  hint,
  tone,
}: {
  label: string;
  hint: string;
  tone: "before" | "after";
}) {
  return (
    <div
      className={clsx(
        "flex h-full w-full flex-col items-center justify-center gap-1 px-4 text-center",
        tone === "before"
          ? "bg-gradient-to-br from-nabi-elevated via-nabi-surface to-nabi-bg"
          : "bg-gradient-to-br from-nabi-neon/20 via-nabi-surface to-nabi-bg"
      )}
    >
      <span
        className={clsx(
          "text-[11px] font-medium uppercase tracking-[0.18em]",
          tone === "after" ? "text-nabi-neon/80" : "text-nabi-muted"
        )}
      >
        {label}
      </span>
      <span className="max-w-[14rem] text-xs text-nabi-muted">{hint}</span>
    </div>
  );
}
