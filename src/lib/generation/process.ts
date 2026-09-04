import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prisma-retry";
import {
  generateImage,
  generateVideoClip,
  CLIP_DURATION_SEC,
} from "@/lib/video-provider";
import {
  assertPersistentObjectStorage,
  persistRemoteAsset,
} from "@/lib/storage/object-storage";
import { resolvePrivateDeliveryUrl } from "@/lib/storage/signed-url";
import { attachCompletedGenerationAsset } from "@/lib/projects/assets";
import type { GenerationType } from "@prisma/client";
import {
  isImageEngineId,
  isVideoEngineId,
  engineHasNativeAudio,
  type FrameRate,
  type RenderQuality,
} from "@/lib/ai/catalog";
import {
  ensureMockAssetPath,
  mockPublicPath,
  shouldInstantMockGenerate,
} from "@/lib/generation/dev-mock";
import { failAndRefundGeneration } from "@/lib/generation/fail-and-refund";
import {
  classifyGenerationFailure,
  createPipelineTrace,
  isRecoverableLocalMockFailure,
  localFallbackMedia,
  type PipelineLogEntry,
} from "@/lib/generation/pipeline";
import {
  acquireGenerationJobLock,
  releaseGenerationJobLock,
} from "@/lib/generation/job-lock";
import { whiteLabelEngine, whiteLabelModel } from "@/lib/models";
import { atomicChargeCoins } from "@/lib/ledger/atomic";
import type { EmotionMode, GenerationKind } from "@/lib/credits";
import path from "path";
import { resolveBgmSelection, muxVideoWithAmbientBgm } from "@/lib/bgm";
import type { BgmMode } from "@/lib/bgm/types";
import { recordInterestFromGeneration } from "@/lib/producer/interest-profile";
import { isFfmpegAvailable } from "@/lib/ffmpeg-worker";
import type { CinematicControls } from "@/lib/ai/provider-registry";

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
  endImageUrl?: string | null;
  sourceVideoId?: string | null;
  cinematicControls?: CinematicControls | null;
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
  errorCode?: string;
  pipelineStage?: string;
  pipelineLog?: PipelineLogEntry[];
  recovered?: boolean;
  refunded?: boolean;
  balanceAfter?: number;
  creditsCost?: number;
}> {
  const trace = createPipelineTrace(generationId);
  const generation = await prisma.generation.findUnique({
    where: { id: generationId },
  });
  if (!generation) {
    const classified = classifyGenerationFailure(
      "Generation not found",
      "queue"
    );
    trace.error("queue", classified.message, classified.code);
    return {
      ok: false,
      error: classified.message,
      errorCode: classified.code,
      pipelineStage: classified.stage,
      pipelineLog: trace.entries,
    };
  }
  if (
    generation.status === "COMPLETED" &&
    (generation.resultUrl || generation.r2Key)
  ) {
    return {
      ok: true,
      resultUrl:
        (await resolvePrivateDeliveryUrl({
          objectKey: generation.r2Key,
          resultUrl: generation.resultUrl,
        })) || undefined,
      creditsCost: generation.creditsCost,
    };
  }
  if (generation.status === "FAILED") {
    const classified = classifyGenerationFailure(
      generation.errorMessage || "Generation failed",
      "queue"
    );
    trace.error("queue", classified.message, classified.code);
    return {
      ok: false,
      error: classified.message,
      errorCode: classified.code,
      pipelineStage: classified.stage,
      pipelineLog: trace.entries,
      creditsCost: generation.creditsCost,
    };
  }

  const lock = await acquireGenerationJobLock(generationId);
  if (lock === "busy") {
    const classified = classifyGenerationFailure(
      "Generation already in progress",
      "queue"
    );
    trace.error("queue", classified.message, classified.code);
    return {
      ok: false,
      error: classified.message,
      errorCode: classified.code,
      pipelineStage: classified.stage,
      pipelineLog: trace.entries,
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
  let recovered = false;
  const instantMock = shouldInstantMockGenerate();

  try {
    trace.ok(
      "queue",
      instantMock ? "Instant mock job accepted" : "Generation job accepted"
    );
    /*
     * Do this before charging or calling a paid provider. Local disk cannot
     * retain a completed asset across production serverless invocations.
     * Instant mock writes public/dev-mock fixtures and never needs R2/S3.
     */
    if (!instantMock) {
      assertPersistentObjectStorage();
    }

    try {
      await withPrismaRetry(() =>
        prisma.generation.update({
          where: { id: generationId },
          data: {
            status: "GENERATING_VIDEO",
            errorMessage: null,
          },
        })
      );
      await prisma.modelRun.updateMany({
        where: { generationId },
        data: { status: "RUNNING", failureCode: null },
      });
    } catch (statusErr) {
      if (!instantMock) throw statusErr;
      recovered = true;
      trace.recovered(
        "queue",
        "Status write skipped after database reset",
        "NETWORK_RESET"
      );
    }

    /* Debit only once, right before paid work (provider or billed mock). */
    if (creditsCost <= 0) {
      try {
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
          const classified = classifyGenerationFailure(charge.message, "queue");
          if (instantMock && classified.code !== "CHARGE_FAILED") {
            recovered = true;
            trace.recovered("queue", classified.message, classified.code);
          } else {
            trace.error("queue", classified.message, classified.code);
            await failAndRefundGeneration({
              generationId,
              error: charge.message,
              errorCode: classified.code,
              area: "project-charge-preflight",
            });
            return {
              ok: false,
              error: classified.message,
              errorCode: classified.code,
              pipelineStage: classified.stage,
              pipelineLog: trace.entries,
              balanceAfter: charge.balanceAfter,
              creditsCost: charge.cost,
            };
          }
        } else {
          creditsCost = charge.cost;
          balanceAfter = charge.balanceAfter;
        }
      } catch (chargeErr) {
        if (!instantMock) throw chargeErr;
        recovered = true;
        trace.recovered(
          "queue",
          "Charge skipped after database reset",
          "NETWORK_RESET"
        );
      }
    }

    let providerUrl = "";
    let provider = "Studio";
    let model = "Cinematic";
    let engineId = "auto";

    if (instantMock) {
      providerUrl = ensureMockAssetPath(
        isImageType(generation.type) ? "image" : "video"
      );
      provider = "Al-Nabi Studio";
      model = "Dev Preview";
      engineId = String(costEngine);
    } else if (isImageType(generation.type)) {
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
        quality,
        imageUrl: generation.sourceImageUrl || undefined,
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
        endImageUrl: meta.endImageUrl || undefined,
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
        sourceVideoId: meta.sourceVideoId || undefined,
        cinematicControls: meta.cinematicControls || undefined,
      });
      providerUrl = clip.url;
      provider = whiteLabelEngine(clip.provider);
      model = whiteLabelModel(clip.model);
      engineId = clip.engineId || videoEngine;
    }

    if (!providerUrl) {
      throw new Error("Provider returned empty URL");
    }

    /* Optional ambient BGM under (usually silent) provider video. It is
     * disabled unless this worker has passed the FFmpeg capability check. */
    /* Native-audio flagship already ships dialogue + Foley. Extra BGM
     * would fight that mix — only mux when the engine is silent. */
    if (
      !instantMock &&
      !isImageType(generation.type) &&
      !engineHasNativeAudio(engineId) &&
      (await isFfmpegAvailable())
    ) {
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
    } else if (
      !instantMock &&
      !isImageType(generation.type) &&
      meta.bgmMode !== "off" &&
      !engineHasNativeAudio(engineId)
    ) {
      console.warn(
        "[Alnabiy] ambient BGM disabled because FFmpeg is unavailable for this runtime"
      );
    }

    const mediaKind = isImageType(generation.type) ? "image" : "video";
    let stored: Awaited<ReturnType<typeof persistRemoteAsset>>;
    if (instantMock) {
      stored = {
        key: `generations/${generation.userId}/${generationId}/dev-preview.${mediaKind === "image" ? "png" : "mp4"}`,
        url: mockPublicPath(mediaKind),
        provider: "local",
      };
      trace.ok("mock-persist", "Local mock fixture ready — no network persist");
    } else {
      stored = await persistRemoteAsset({
        sourceUrl: providerUrl,
        userId: generation.userId,
        generationId,
        kind: mediaKind,
      });
      trace.ok("mock-persist", "Provider asset persisted");
    }

    const publicProvider = whiteLabelEngine(engineId) || provider;
    const mockDelivery = instantMock
      ? mockPublicPath(mediaKind)
      : null;
    let deliveryUrl =
      mockDelivery ||
      (await resolvePrivateDeliveryUrl({
        objectKey: stored.key,
        resultUrl: stored.url,
      }));
    if (!deliveryUrl && instantMock) {
      recovered = true;
      deliveryUrl = localFallbackMedia(mediaKind);
      trace.recovered(
        "mock-persist",
        "Delivery URL missing — using bundled preview",
        "EMPTY_RESULT"
      );
    }
    if (!deliveryUrl) {
      throw new Error("Private media could not be signed for delivery");
    }

    try {
      await withPrismaRetry(async () => {
        await prisma.generation.update({
          where: { id: generationId },
          data: {
            status: "COMPLETED",
            resultUrl: deliveryUrl,
            r2Key: stored.key,
            provider: `${publicProvider} · ${model}`,
            errorMessage: null,
          },
        });
        await prisma.renderVersion.updateMany({
          where: { generationId },
          data: {
            status: "COMPLETED",
            provider,
            model,
            outputUrl: stored.url,
            outputR2Key: stored.key,
            creditsCost,
          },
        });
        await prisma.modelRun.updateMany({
          where: { generationId },
          data: {
            status: "COMPLETED",
            responseMetadata: {
              delivered: true,
              mock: instantMock,
              recovered,
              provider,
              model,
              durationSec: generation.durationSec,
              pipelineLog: trace.entries,
            },
            failureCode: null,
          },
        });
      });
    } catch (completeErr) {
      if (!instantMock) throw completeErr;
      recovered = true;
      trace.recovered(
        "mock-persist",
        "Completed locally after database reset",
        "NETWORK_RESET"
      );
    }

    if (generation.projectId) {
      await attachCompletedGenerationAsset({
        userId: generation.userId,
        projectId: generation.projectId,
        generationId,
      }).catch((attachError) => {
        console.warn(
          "[Alnabiy] project asset attach skipped",
          generationId,
          attachError
        );
      });
    }

    await recordInterestFromGeneration({
      userId: generation.userId,
      prompt: prompt,
      style: generation.style,
      durationSec: generation.durationSec,
      aspect: aspect,
    }).catch((interestErr) => {
      console.warn(
        "[Alnabiy] interest profile skipped",
        generationId,
        interestErr
      );
    });

    return {
      ok: true,
      resultUrl: deliveryUrl,
      recovered,
      pipelineLog: trace.entries,
      balanceAfter,
      creditsCost,
    };
  } catch (e) {
    const classified = classifyGenerationFailure(e, "mock-persist");
    if (instantMock && isRecoverableLocalMockFailure(classified.code)) {
      const mediaKind = isImageType(generation.type) ? "image" : "video";
      const deliveryUrl = localFallbackMedia(mediaKind);
      recovered = true;
      trace.recovered("mock-persist", classified.message, classified.code);
      try {
        ensureMockAssetPath(mediaKind);
      } catch {
        /* public /dev-mock path is still returned */
      }
      try {
        await prisma.generation.update({
          where: { id: generationId },
          data: {
            status: "COMPLETED",
            resultUrl: deliveryUrl,
            errorMessage: null,
          },
        });
        await prisma.renderVersion.updateMany({
          where: { generationId },
          data: { status: "COMPLETED", outputUrl: deliveryUrl },
        });
        await prisma.modelRun.updateMany({
          where: { generationId },
          data: {
            status: "COMPLETED",
            responseMetadata: {
              delivered: true,
              mock: true,
              recovered: true,
              pipelineLog: trace.entries,
            },
            failureCode: null,
          },
        });
        return {
          ok: true,
          resultUrl: deliveryUrl,
          recovered: true,
          pipelineLog: trace.entries,
          balanceAfter,
          creditsCost,
        };
      } catch (completeErr) {
        console.warn(
          "[Al-Nabi] local mock complete failed",
          generationId,
          completeErr
        );
      }
    }
    trace.error(classified.stage, classified.message, classified.code);
    const result = await failAndRefundGeneration({
      generationId,
      error: e,
      errorCode: classified.code,
      area: "processGenerationJob",
    });
    return {
      ok: false,
      error: classified.message,
      errorCode: classified.code,
      pipelineStage: classified.stage,
      pipelineLog: trace.entries,
      refunded: result.refunded,
      balanceAfter: result.balanceAfter,
      creditsCost,
    };
  } finally {
    if (lock === "acquired") {
      await releaseGenerationJobLock(generationId);
    }
  }
}
