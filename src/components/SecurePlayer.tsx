"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Maximize2, Minimize2, Pause, Play, Repeat } from "lucide-react";
import { useMaster } from "@/context/MasterControllerContext";
import { WATERMARK } from "@/lib/credits";
import { shouldBypassLowDataMode } from "@/lib/security/client-mode";
import { previewFingerprint } from "@/lib/security/preview-fingerprint";
import clsx from "clsx";

interface Props {
  src?: string | null;
  autoPlay?: boolean;
  muted?: boolean;
  /** Grid hover cards — muted loop, no transport UI */
  mode?: "full" | "thumb";
  className?: string;
  /** Thumb: play while hovered / focused */
  hoverPlay?: boolean;
  /** External timeline seek — applied when token changes. */
  seekRequest?: { token: number; time: number } | null;
  /** Report decoded time so the studio timeline can stay in sync. */
  onTimeChange?: (current: number, duration: number) => void;
  /** Optional play/pause driven by the timeline transport. */
  controlledPlaying?: boolean;
  onPlayingChange?: (playing: boolean) => void;
}

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SYNTHETIC_DURATION_SEC = 10;

function isDevMockSrc(src?: string | null) {
  return Boolean(src && src.includes("/dev-mock/"));
}

/**
 * Canvas-composited preview player.
 * Screen captures include a moving forensic watermark; clean file stays on Download.
 */
export function SecurePlayer({
  src,
  autoPlay = true,
  muted = true,
  mode = "full",
  className,
  hoverPlay = false,
  seekRequest = null,
  onTimeChange,
  controlledPlaying,
  onPlayingChange,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const captureLock = useRef(false);
  const { tr, lowDataMode, email, alnabiyKey } = useMaster();
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [loop, setLoop] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [decodeFailed, setDecodeFailed] = useState(false);
  const syntheticClock = useRef(0);
  const lastAnimTs = useRef(0);
  const useSynthetic = isDevMockSrc(src) || decodeFailed;
  const useSyntheticRef = useRef(useSynthetic);
  useSyntheticRef.current = useSynthetic;

  const dataBlocked = useMemo(
    () => lowDataMode && !shouldBypassLowDataMode(),
    [lowDataMode]
  );

  const fingerprint = useMemo(
    () => previewFingerprint(email, alnabiyKey),
    [email, alnabiyKey]
  );

  const drawFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!useSyntheticRef.current && !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    if (w < 2 || h < 2) return;

    if (captureLock.current) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      return;
    }

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    if (useSyntheticRef.current) {
      const pulse = performance.now() / 1000;
      const sky = ctx.createLinearGradient(0, 0, w, h);
      sky.addColorStop(0, "#0b1020");
      sky.addColorStop(0.5, "#1a1240");
      sky.addColorStop(1, "#071018");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 9; i++) {
        const y = ((pulse * (18 + i * 6) + i * 36) % (h + 48)) - 24;
        ctx.fillStyle =
          i % 2 ? "rgba(232, 197, 71, 0.14)" : "rgba(56, 189, 248, 0.16)";
        ctx.fillRect(0, y, w, 2);
      }

      const glow = ctx.createRadialGradient(
        w * 0.5,
        h * 0.7,
        8,
        w * 0.5,
        h * 0.7,
        w * 0.55
      );
      glow.addColorStop(0, "rgba(232, 197, 71, 0.3)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.font = `600 ${Math.max(13, Math.round(w * 0.034))}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText("Al-Nabi Dev Preview", w / 2, h * 0.46);
      ctx.textAlign = "start";
    } else if (video && video.readyState >= 2 && video.videoWidth > 0) {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const scale = Math.min(w / vw, h / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      const dx = (w - dw) / 2;
      const dy = (h - dh) / 2;
      ctx.drawImage(video, dx, dy, dw, dh);
    }

    const t = performance.now() / 1000;
    const label = `${WATERMARK} · ${fingerprint} · ${new Date().toLocaleTimeString()}`;
    const fontSize = Math.max(11, Math.round(w * 0.028));
    ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textBaseline = "middle";

    const metrics = ctx.measureText(label);
    const padX = 10;
    const padY = 6;
    const boxW = metrics.width + padX * 2;
    const boxH = fontSize + padY * 2;
    const periodX = Math.max(w - boxW - 16, 1);
    const periodY = Math.max(h - boxH - 16, 1);
    const x = 8 + ((t * 38) % periodX);
    const y = 8 + ((t * 23 + fingerprint.charCodeAt(0)) % periodY);

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(x, y, boxW, boxH);
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillText(label, x + padX, y + boxH / 2);

    /* Secondary faint diagonal marks */
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.translate(w * 0.5, h * 0.5);
    ctx.rotate(-0.35);
    ctx.font = `500 ${Math.max(14, fontSize * 1.4)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.fillText(`${WATERMARK} ${fingerprint}`, 0, 0);
    ctx.restore();
  }, [fingerprint]);

  const syncCanvasSize = useCallback(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(2, Math.floor(rect.width * dpr));
    const h = Math.max(2, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }, []);

  useEffect(() => {
    setDecodeFailed(false);
    syntheticClock.current = 0;
    lastAnimTs.current = 0;
    setCurrent(0);
    if (isDevMockSrc(src)) setDuration(SYNTHETIC_DURATION_SEC);
  }, [src]);

  useEffect(() => {
    if (!src || dataBlocked) return;
    if (!useSynthetic) return;
    if (autoPlay && !hoverPlay) {
      setPlaying(true);
      onPlayingChange?.(true);
    }
  }, [src, dataBlocked, useSynthetic, autoPlay, hoverPlay, onPlayingChange]);

  useEffect(() => {
    if (!src || dataBlocked) return;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      syncCanvasSize();
      drawFrame();
      if (useSyntheticRef.current) {
        const now = performance.now();
        const dt = lastAnimTs.current ? (now - lastAnimTs.current) / 1000 : 0;
        lastAnimTs.current = now;
        if (playing) {
          syntheticClock.current += dt;
          if (syntheticClock.current >= SYNTHETIC_DURATION_SEC) {
            if (loop || mode === "thumb") {
              syntheticClock.current = 0;
            } else {
              syntheticClock.current = SYNTHETIC_DURATION_SEC;
              setPlaying(false);
              onPlayingChange?.(false);
            }
          }
          setCurrent(syntheticClock.current);
          setDuration(SYNTHETIC_DURATION_SEC);
          onTimeChange?.(syntheticClock.current, SYNTHETIC_DURATION_SEC);
        }
      } else {
        const v = videoRef.current;
        if (v && !v.paused && !v.ended) {
          setCurrent(v.currentTime);
          onTimeChange?.(v.currentTime, v.duration || duration);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [
    src,
    dataBlocked,
    drawFrame,
    syncCanvasSize,
    onTimeChange,
    duration,
    playing,
    loop,
    mode,
    onPlayingChange,
  ]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src || dataBlocked) return;
    video.muted = muted || autoPlay || mode === "thumb";
    video.playsInline = true;
    if (!autoPlay && !hoverPlay) return;
    if (hoverPlay) return;
    const tryPlay = () => {
      void video.play().then(() => setPlaying(true)).catch(() => {});
    };
    tryPlay();
    video.addEventListener("loadeddata", tryPlay);
    video.addEventListener("canplay", tryPlay);
    return () => {
      video.removeEventListener("loadeddata", tryPlay);
      video.removeEventListener("canplay", tryPlay);
    };
  }, [src, autoPlay, muted, dataBlocked, mode, hoverPlay]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onMeta = () => setDuration(video.duration || 0);
    const onPlay = () => {
      setPlaying(true);
      onPlayingChange?.(true);
    };
    const onPause = () => {
      setPlaying(false);
      onPlayingChange?.(false);
    };
    const onTime = () => {
      setCurrent(video.currentTime);
      onTimeChange?.(video.currentTime, video.duration || duration);
    };
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTime);
    return () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTime);
    };
  }, [src, onTimeChange, duration]);

  useEffect(() => {
    const onCapture = (e: Event) => {
      const active = (e as CustomEvent<{ active?: boolean }>).detail?.active;
      captureLock.current = Boolean(active);
      const video = videoRef.current;
      if (active) {
        video?.pause();
        setPlaying(false);
      }
      drawFrame();
    };
    window.addEventListener("alnabiy:capture", onCapture as EventListener);
    return () =>
      window.removeEventListener("alnabiy:capture", onCapture as EventListener);
  }, [drawFrame]);

  const togglePlay = () => {
    if (captureLock.current) return;
    if (useSynthetic) {
      const next = !playing;
      setPlaying(next);
      onPlayingChange?.(next);
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().then(() => {
        setPlaying(true);
        onPlayingChange?.(true);
      }).catch(() => {});
    } else {
      video.pause();
      setPlaying(false);
      onPlayingChange?.(false);
    }
  };

  useEffect(() => {
    if (!src || dataBlocked) return;
    if (typeof controlledPlaying !== "boolean") return;
    if (useSynthetic) {
      setPlaying(controlledPlaying);
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (controlledPlaying && video.paused) {
      void video.play().then(() => setPlaying(true)).catch(() => {});
    } else if (!controlledPlaying && !video.paused) {
      video.pause();
      setPlaying(false);
    }
  }, [controlledPlaying, src, dataBlocked, useSynthetic]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !seekRequest) return;
    if (!Number.isFinite(seekRequest.time)) return;
    video.currentTime = Math.max(0, seekRequest.time);
    setCurrent(video.currentTime);
  }, [seekRequest]);

  const toggleLoop = () => {
    const video = videoRef.current;
    const next = !loop;
    setLoop(next);
    if (video) video.loop = next;
  };

  const toggleFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen?.();
    }
  };

  useEffect(() => {
    const onFs = () =>
      setFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const onSeek = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    if (useSynthetic) {
      syntheticClock.current = ratio * SYNTHETIC_DURATION_SEC;
      setCurrent(syntheticClock.current);
      setDuration(SYNTHETIC_DURATION_SEC);
      onTimeChange?.(syntheticClock.current, SYNTHETIC_DURATION_SEC);
      return;
    }
    const video = videoRef.current;
    if (!video || !duration) return;
    video.currentTime = ratio * duration;
    setCurrent(video.currentTime);
    onTimeChange?.(video.currentTime, duration);
  };

  const onThumbEnter = () => {
    if (!hoverPlay || captureLock.current) return;
    if (useSynthetic) {
      setPlaying(true);
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    void video.play().then(() => setPlaying(true)).catch(() => {});
  };

  const onThumbLeave = () => {
    if (!hoverPlay) return;
    if (useSynthetic) {
      setPlaying(false);
      syntheticClock.current = 0;
      setCurrent(0);
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
    setPlaying(false);
    setCurrent(0);
  };

  const blockMenu = (e: { preventDefault: () => void }) => {
    e.preventDefault();
  };

  return (
    <div
      ref={wrapRef}
      className={clsx(
        "relative aspect-video overflow-hidden rounded-xl bg-black",
        mode === "thumb" && "h-full min-h-[140px] rounded-none aspect-auto",
        className
      )}
      data-alnabiy-secure="1"
      onContextMenu={blockMenu}
      onMouseEnter={onThumbEnter}
      onMouseLeave={onThumbLeave}
    >
      {dataBlocked && (
        <div className="absolute inset-x-0 top-0 z-20 bg-amber-500/20 px-2 py-1 text-center text-[10px] text-amber-300">
          {tr("low_data_warning")}
        </div>
      )}
      {src && !dataBlocked ? (
        <>
          {/* Source decoder — never the visible surface */}
          {!useSynthetic ? (
          <video
            ref={videoRef}
            key={src}
            src={src}
            playsInline
            muted={muted || autoPlay || mode === "thumb"}
            loop={mode === "thumb" || loop}
            preload="metadata"
            controls={false}
            controlsList="nodownload noremoteplayback noplaybackrate"
            disablePictureInPicture
            disableRemotePlayback
            onError={() => {
              setDecodeFailed(true);
              setDuration(SYNTHETIC_DURATION_SEC);
            }}
            onContextMenu={blockMenu}
            className="pointer-events-none absolute h-px w-px opacity-0"
            aria-hidden
          />
          ) : null}
          <canvas
            ref={canvasRef}
            className="alnabiy-secure-canvas absolute inset-0 h-full w-full touch-none"
            onContextMenu={blockMenu}
            onClick={mode === "full" ? togglePlay : undefined}
          />
          {mode === "full" && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-8">
              <div className="pointer-events-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/25"
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <div
                  role="slider"
                  aria-valuemin={0}
                  aria-valuemax={duration || 0}
                  aria-valuenow={current}
                  tabIndex={0}
                  className="h-1.5 flex-1 cursor-pointer rounded-full bg-white/20"
                  onPointerDown={onSeek}
                >
                  <div
                    className="h-full rounded-full bg-white/80"
                    style={{
                      width: `${duration ? (current / duration) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="min-w-[4.5rem] text-right text-[10px] tabular-nums text-white/80">
                  {formatTime(current)} / {formatTime(duration)}
                </span>
                <button
                  type="button"
                  onClick={toggleLoop}
                  className={clsx(
                    "inline-flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-sm transition",
                    loop
                      ? "nabi-select-on"
                      : "bg-white/15 text-white hover:bg-white/25"
                  )}
                  aria-label="Loop"
                  aria-pressed={loop}
                >
                  <Repeat size={14} />
                </button>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/25"
                  aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex h-full min-h-[140px] items-center justify-center text-xs text-nabi-muted">
          {WATERMARK}
        </div>
      )}
    </div>
  );
}
