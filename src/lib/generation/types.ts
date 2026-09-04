import type { GenerationType } from "@prisma/client";

export type StudioMediaKind = "image" | "video";

/**
 * Map Studio media + optional first/last frame onto the Prisma Generation type.
 * Image-to-video is a first-frame (or last-frame) still plus a video job.
 */
export function resolveGenerationType(input: {
  mediaKind: StudioMediaKind;
  imageUrl?: string | null;
  endImageUrl?: string | null;
}): Extract<GenerationType, "IMAGE" | "IMAGE_TO_VIDEO" | "TEXT_TO_VIDEO"> {
  if (input.mediaKind === "image") return "IMAGE";
  if (input.imageUrl?.trim() || input.endImageUrl?.trim()) {
    return "IMAGE_TO_VIDEO";
  }
  return "TEXT_TO_VIDEO";
}

export type GenerateQueuedResponse = {
  ok: boolean;
  success?: boolean;
  queued?: boolean;
  generationId?: string;
  jobId?: string;
  status?: string;
  done?: boolean;
  failed?: boolean;
  resultUrl?: string | null;
  videoUrl?: string | null;
  imageUrl?: string | null;
  r2Key?: string | null;
  statusUrl?: string;
  projectId?: string | null;
  shotId?: string | null;
  creditsCost?: number;
  creditsPending?: boolean;
  balanceAfter?: number;
  receiptId?: string;
  error?: string;
  errorMessage?: string;
  code?: string;
  provider?: string;
  alnabiyKey?: string;
  alnabiy_key?: string;
};
