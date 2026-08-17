"use client";

import clsx from "clsx";
import { Film, Mic2, CheckCircle2, CircleDashed, Loader2 } from "lucide-react";
import type { Scene } from "@/lib/types";
import { useMaster } from "@/context/MasterControllerContext";

export type EpisodeSceneStatus =
  | "pending"
  | "audio"
  | "video"
  | "done"
  | "error";

type Props = {
  scenes: Scene[];
  sceneStatus?: Record<number, EpisodeSceneStatus>;
  activeIndex?: number | null;
  jobId?: string;
};

/**
 * Script-to-Movie — sahnа / epizod kartochkalari + TTS/video holati.
 */
export function EpisodeBoard({
  scenes,
  sceneStatus = {},
  activeIndex = null,
  jobId,
}: Props) {
  const { tr } = useMaster();
  if (!scenes.length) return null;

  return (
    <div className="nabi-card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          {tr("episodes_title")} ({scenes.length})
        </h2>
        {jobId && (
          <span className="truncate font-mono text-[10px] text-nabi-muted">
            {jobId}
          </span>
        )}
      </div>
      <p className="text-xs text-nabi-muted">{tr("episodes_hint")}</p>
      <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
        {scenes.map((s) => {
          const st = sceneStatus[s.index] || "pending";
          const active = activeIndex === s.index;
          return (
            <div
              key={s.index}
              className={clsx(
                "rounded-xl border p-3 text-xs transition",
                active
                  ? "nabi-select-on"
                  : "border-nabi-border bg-nabi-surface"
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-medium text-nabi-neon">
                  <Film size={12} />
                  {tr("episode_label", { n: s.index + 1 })}
                </span>
                <span className="text-nabi-muted">
                  {s.duration}s · {s.camera_movement}
                </span>
              </div>
              <p className="mb-2 line-clamp-2 text-nabi-muted">{s.visual_prompt}</p>
              <p className="mb-2 flex items-start gap-1.5 line-clamp-2 text-nabi-muted">
                <Mic2 size={12} className="mt-0.5 shrink-0" />
                {s.voice_text}
              </p>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
                {st === "pending" && (
                  <>
                    <CircleDashed size={12} className="text-nabi-muted" />
                    <span className="text-nabi-muted">{tr("episode_pending")}</span>
                  </>
                )}
                {st === "audio" && (
                  <>
                    <Loader2 size={12} className="animate-spin text-amber-300" />
                    <span className="text-amber-300">{tr("episode_tts")}</span>
                  </>
                )}
                {st === "video" && (
                  <>
                    <Loader2 size={12} className="animate-spin text-nabi-neon" />
                    <span className="text-nabi-neon">{tr("episode_video")}</span>
                  </>
                )}
                {st === "done" && (
                  <>
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    <span className="text-emerald-400">{tr("episode_done")}</span>
                  </>
                )}
                {st === "error" && (
                  <span className="text-rose-400">{tr("episode_error")}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
