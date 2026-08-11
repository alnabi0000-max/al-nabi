import { prisma } from "@/lib/prisma";
import {
  generateImage,
  generateVideoClip,
  CLIP_DURATION_SEC,
} from "@/lib/video-provider";
import { persistRemoteAsset } from "@/lib/storage/object-storage";
import type { GenerationType } from "@prisma/client";
import {
  isImageEngineId,
  isVideoEngineId,
  type FrameRate,
  type RenderQuality,
} from "@/lib/ai/catalog";
import {
  MOCK_IMAGE_URL,
  MOCK_VIDEO_URL,
  shouldInstantMockGenerate,
} from "@/lib/generation/dev-mock";
import { failAndRefundGeneration } from "@/lib/generation/fail-and-refund";
import { whiteLabelEngine, whiteLabelModel } from "@/lib/models";

function isImageType(type: GenerationType): boolean {
  return type === "IMAGE";
}

type ScenesMeta = {
  aspect?: "16:9" | "9:16" | "1:1";
  engine?: string;
  imageEngine?: string;
  frameRate?: number;
};

/**
 * Background worker — Inngest yoki local after().
 * Failure → sanitized error + automatic credit refund (idempotent).
 */
export async function processGenerationJob(generationId: string): Promise<{
  ok: boolean;
  resultUrl?: string;
  error?: string;
  refunded?: boolean;
}> {
  const generation = await prisma.generation.findUnique({
    where: { id: generationId },
  });
  if (!generation) {
    return { ok: false, error: "Generation not found" };
  }
  if (generation.status === "COMPLETED" && generation.resultUrl) {
    return { ok: true, resultUrl: generation.resultUrl };
  }
  if (generation.status === "FAILED") {
    return {
      ok: false,
      error: generation.errorMessage || "Generation failed",
    };
  }

  const prompt =
    generation.enhancedPrompt || generation.prompt || "Alnabiy cinematic scene";

  const meta = (generation.scenesJson || {}) as ScenesMeta;
  const quality = (generation.quality as RenderQuality) || "1080p";
  const aspect = meta.aspect || "16:9";
  const frameRate = (meta.frameRate as FrameRate | undefined) || 24;

  try {
    await prisma.generation.update({
      where: { id: generationId },
      data: {
        status: "GENERATING_VIDEO",
        errorMessage: null,
      },
    });

    if (shouldInstantMockGenerate()) {
      const resultUrl = isImageType(generation.type)
        ? MOCK_IMAGE_URL
        : MOCK_VIDEO_URL;
      await prisma.generation.update({
        where: { id: generationId },
        data: {
          status: "COMPLETED",
          resultUrl,
          r2Key: null,
          provider: "Al-Nabi Studio",
          errorMessage: null,
        },
      });
      return { ok: true, resultUrl };
    }

    let providerUrl = "";
    let provider = "Al-Nabi Studio";
    let model = "Al-Nabi Cinematic";
    let engineId = "auto";

    if (isImageType(generation.type)) {
      const imageEngine =
        meta.imageEngine && isImageEngineId(meta.imageEngine)
          ? meta.imageEngine
          : meta.engine && isImageEngineId(meta.engine)
            ? meta.engine
            : "auto";
      const img = await generateImage({
        prompt,
        aspect,
        engine: imageEngine,
      });
      providerUrl = img.url;
      provider = whiteLabelEngine(img.provider);
      model = whiteLabelModel(img.model);
      engineId = img.engineId || imageEngine;
    } else {
      const videoEngine =
        meta.engine && isVideoEngineId(meta.engine) ? meta.engine : "auto";
      const clip = await generateVideoClip({
        prompt,
        imageUrl: generation.sourceImageUrl || undefined,
        cameraMove: (generation.cameraMove as
          | "static"
          | "zoom_in"
          | "zoom_out"
          | "pan_left"
          | "pan_right"
          | "tilt_up"
          | "tilt_down"
          | "slow_mo"
          | "orbit"
          | undefined) || "static",
        quality,
        engine: videoEngine,
        frameRate,
        aspect,
        durationSec: Math.min(
          CLIP_DURATION_SEC,
          generation.durationSec || CLIP_DURATION_SEC
        ),
      });
      providerUrl = clip.url;
      provider = whiteLabelEngine(clip.provider);
      model = whiteLabelModel(clip.model);
      engineId = clip.engineId || videoEngine;
    }

    if (!providerUrl) {
      throw new Error("Provider returned empty URL");
    }

    const stored = await persistRemoteAsset({
      sourceUrl: providerUrl,
      userId: generation.userId,
      generationId,
      kind: isImageType(generation.type) ? "image" : "video",
    });

    const publicProvider = whiteLabelEngine(engineId) || provider;

    await prisma.generation.update({
      where: { id: generationId },
      data: {
        status: "COMPLETED",
        resultUrl: stored.url,
        r2Key: stored.key,
        provider: `${publicProvider} · ${model}`,
        errorMessage: null,
      },
    });

    return { ok: true, resultUrl: stored.url };
  } catch (e) {
    const result = await failAndRefundGeneration({
      generationId,
      error: e,
      area: "processGenerationJob",
    });
    return {
      ok: false,
      error: result.errorMessage,
      refunded: result.refunded,
    };
  }
}
