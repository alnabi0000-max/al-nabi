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
import { atomicChargeCoins } from "@/lib/ledger/atomic";
import type { EmotionMode, GenerationKind } from "@/lib/credits";
import path from "path";
import { resolveBgmSelection, muxVideoWithAmbientBgm } from "@/lib/bgm";
import type { BgmMode } from "@/lib/bgm/types";
import { recordInterestFromGeneration } from "@/lib/producer/interest-profile";

function isImageType(type: GenerationType): boolean {
  return type === "IMAGE";
}

function kindFromType(type: GenerationType): GenerationKind {
  if (type === "IMAGE") return "image";
  if (type === "SCRIPT_TO_MOVIE") return "text_to_movie";
  return "prompt_to_video";
}

type ScenesMeta = {
  aspect?: "16:9" | "9:16" | "1:1";
  engine?: string;
  imageEngine?: string;
  frameRate?: number;
  bgmMode?: "ai" | "manual" | "off";
  bgmTrackId?: string | null;
};

/**
 * Background worker — Inngest yoki local after().
 *
 * NC charge happens HERE — immediately before the paid AI provider call —
 * not during API validation / enqueue. Failure after charge → idempotent refund.
 */
export async function processGenerationJob(generationId: string): Promise<{
  ok: boolean;
  resultUrl?: string;
  error?: string;
  refunded?: boolean;
  balanceAfter?: number;
  creditsCost?: number;
}> {
  const generation = await prisma.generation.findUnique({
    where: { id: generationId },
  });
  if (!generation) {
    return { ok: false, error: "Generation not found" };
  }
  if (generation.status === "COMPLETED" && generation.resultUrl) {
    return {
      ok: true,
      resultUrl: generation.resultUrl,
      creditsCost: generation.creditsCost,
    };
  }
  if (generation.status === "FAILED") {
    return {
      ok: false,
      error: generation.errorMessage || "Generation failed",
      creditsCost: generation.creditsCost,
    };
  }

  const prompt =
    generation.enhancedPrompt || generation.prompt || "Alnabiy cinematic scene";

  const meta = (generation.scenesJson || {}) as ScenesMeta;
  const quality = (generation.quality as RenderQuality) || "1080p";
  const aspect = meta.aspect || "16:9";
  const frameRate = (meta.frameRate as FrameRate | undefined) || 24;
  const kind = kindFromType(generation.type);
  const costEngine = isImageType(generation.type)
    ? meta.imageEngine || meta.engine || "auto"
    : meta.engine || "auto";

  let balanceAfter: number | undefined;
  let creditsCost = generation.creditsCost;

  try {
    await prisma.generation.update({
      where: { id: generationId },
      data: {
        status: "GENERATING_VIDEO",
        errorMessage: null,
      },
    });

    /* Debit only once, right before paid work (provider or billed mock). */
    if (creditsCost <= 0) {
      const charge = await atomicChargeCoins({
        userId: generation.userId,
        kind,
        durationSec: isImageType(generation.type)
          ? 1
          : Math.min(
              CLIP_DURATION_SEC,
              generation.durationSec || CLIP_DURATION_SEC
            ),
        generationId,
        reason: `provider:${kind}:${costEngine}`,
        costOpts: {
          engine: costEngine,
          quality,
          frameRate,
        },
      });

      if (!charge.ok) {
        await prisma.generation.update({
          where: { id: generationId },
          data: {
            status: "FAILED",
            errorMessage: charge.message,
          },
        });
        return {
          ok: false,
          error: charge.message,
          balanceAfter: charge.balanceAfter,
          creditsCost: charge.cost,
        };
      }
      creditsCost = charge.cost;
      balanceAfter = charge.balanceAfter;
    }

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
      return { ok: true, resultUrl, balanceAfter, creditsCost };
    }

    let providerUrl = "";
    let provider = "Studio";
    let model = "Cinematic";
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

    /* Optional ambient BGM under (usually silent) provider video */
    if (!isImageType(generation.type)) {
      const bgm = await resolveBgmSelection({
        mode: (meta.bgmMode as BgmMode | undefined) || "ai",
        trackId: meta.bgmTrackId,
        prompt,
        emotion: (generation.emotionMode as EmotionMode | null) || null,
        seed: generationId,
      });
      if (bgm) {
        const root = process.env.STORAGE_DIR || "./storage";
        const workDir = path.join(root, "generations", generationId);
        const withBgm = path.join(workDir, "with_bgm.mp4");
        const durationSec = Math.min(
          CLIP_DURATION_SEC,
          generation.durationSec || CLIP_DURATION_SEC
        );
        try {
          await muxVideoWithAmbientBgm({
            videoPathOrUrl: providerUrl,
            bgmPath: bgm.path,
            outputPath: withBgm,
            durationSec,
            workDir,
          });
          providerUrl = withBgm;
        } catch (bgmErr) {
          console.warn("[Alnabiy] BGM mux skipped", bgmErr);
        }
      }
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

    await recordInterestFromGeneration({
      userId: generation.userId,
      prompt: prompt,
      style: generation.style,
      durationSec: generation.durationSec,
      aspect: aspect,
    });

    return {
      ok: true,
      resultUrl: stored.url,
      balanceAfter,
      creditsCost,
    };
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
      balanceAfter: result.balanceAfter,
      creditsCost,
    };
  }
}
