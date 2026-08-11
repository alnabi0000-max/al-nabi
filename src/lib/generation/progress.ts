import type { GenerationStatus } from "@prisma/client";

export type RenderStage =
  | "queued"
  | "analyzing"
  | "audio"
  | "video"
  | "merging"
  | "uploading"
  | "completed"
  | "failed";

const STATUS_MAP: Record<string, { pct: number; stage: RenderStage }> = {
  QUEUED: { pct: 8, stage: "queued" },
  ANALYZING: { pct: 22, stage: "analyzing" },
  GENERATING_AUDIO: { pct: 40, stage: "audio" },
  GENERATING_VIDEO: { pct: 68, stage: "video" },
  MERGING: { pct: 88, stage: "merging" },
  COMPLETED: { pct: 100, stage: "completed" },
  FAILED: { pct: 100, stage: "failed" },
};

export function progressFromStatus(status?: string | null): {
  percent: number;
  stage: RenderStage;
} {
  if (!status) return { percent: 5, stage: "queued" };
  const hit = STATUS_MAP[status];
  if (!hit) return { percent: 15, stage: "queued" };
  return { percent: hit.pct, stage: hit.stage };
}

/** Script-to-Movie: sahnа indeksi bo‘yicha foiz */
export function progressFromScenePipeline(opts: {
  sceneIndex: number;
  sceneCount: number;
  phase: "analyze" | "audio" | "video" | "merge" | "done" | "fail";
}): { percent: number; stage: RenderStage } {
  const n = Math.max(1, opts.sceneCount);
  const base = (opts.sceneIndex / n) * 80;
  if (opts.phase === "analyze") return { percent: 12, stage: "analyzing" };
  if (opts.phase === "audio")
    return { percent: Math.min(85, 15 + base + 8), stage: "audio" };
  if (opts.phase === "video")
    return { percent: Math.min(90, 20 + base + 20), stage: "video" };
  if (opts.phase === "merge") return { percent: 94, stage: "merging" };
  if (opts.phase === "done") return { percent: 100, stage: "completed" };
  return { percent: 100, stage: "failed" };
}

export function stageLabelKey(stage: RenderStage): string {
  const map: Record<RenderStage, string> = {
    queued: "render_stage_queued",
    analyzing: "render_stage_analyzing",
    audio: "render_stage_audio",
    video: "render_stage_video",
    merging: "render_stage_merging",
    uploading: "render_stage_uploading",
    completed: "render_stage_completed",
    failed: "render_stage_failed",
  };
  return map[stage];
}

export type { GenerationStatus };
