import { NextRequest } from "next/server";
import { z } from "zod";
import { enhancePrompt, SentinelBlockedError } from "@/lib/llm";
import { CLIP_DURATION_SEC } from "@/lib/video-provider";
import { AlnabiySentinelEngine } from "@/lib/sentinel-engine";
import { WATERMARK, chargeableDurationSec } from "@/lib/credits";
import { t, resolveLocale } from "@/lib/i18n/messages";
import { prisma } from "@/lib/prisma";
import { assertSufficientCoins } from "@/lib/ledger/atomic";
import { enqueueGeneration } from "@/lib/generation/enqueue";
import { failAndRefundGeneration } from "@/lib/generation/fail-and-refund";
import { sanitizePublicPayload } from "@/lib/models";
import { resolveGenerationType } from "@/lib/generation/types";
import { ensureStudioWorkspace } from "@/lib/projects/ensure-studio";
import { guardSensitiveRequest, guardGenerationLoad } from "@/lib/security/request-guard";
import {
  getVideoGenerationEstimate,
  ProviderRoutingError,
} from "@/lib/ai/provider-registry";
import {
  ProjectSpendCapError,
  reserveProjectSpend,
} from "@/lib/projects/spend";
import {
  ensureRequestLedgerUser,
  isSoftAuthEnabled,
} from "@/lib/auth/ensure-request-user";
import { attachSessionCookie } from "@/lib/auth/session";
import {
  apiError,
  apiJson,
  formatRouteError,
} from "@/lib/api/json-response";
import { resolvePrivateDeliveryUrl } from "@/lib/storage/signed-url";
import { enforceGenerationTrust } from "@/lib/trust/generation-gate";
import {
  classifyGenerationFailure,
  createPipelineTrace,
  failedGenerateErrorFields,
  isRecoverableLocalMockFailure,
  localFallbackMedia,
  type PipelineLogEntry,
} from "@/lib/generation/pipeline";
import {
  ensureMockAssetPath,
  shouldInstantMockGenerate,
  shouldRejectUnconfiguredProvider,
} from "@/lib/generation/dev-mock";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ENGINE_IDS = [
  "kling-v2.5",
  "kling-v3",
  "luma-ray2",
  "runway-gen3",
  "wan-2.5",
  "minimax",
  "flux-pro",
  "sd3.5-large",
  "auto",
] as const;

const cinematicControlsSchema = z
  .object({
    mode: z.enum(["standard", "video-to-video", "continuation"]).default("standard"),
    sourceAssetId: z.string().min(1).max(100).optional().nullable(),
    sourceRenderVersionId: z.string().min(1).max(100).optional().nullable(),
    seed: z.number().int().min(0).max(2_147_483_647).optional().nullable(),
    audioMix: z
      .object({
        masterMuted: z.boolean().optional(),
        masterVolume: z.number().min(0).max(2).optional(),
        musicVolume: z.number().min(0).max(2).optional(),
        voiceVolume: z.number().min(0).max(2).optional(),
      })
      .strict()
      .optional()
      .nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const sourceCount = Number(Boolean(value.sourceAssetId)) +
      Number(Boolean(value.sourceRenderVersionId));
    if (value.mode === "standard" && sourceCount > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceAssetId"],
        message: "A source video requires video-to-video or continuation mode.",
      });
    }
    if (value.mode !== "standard" && sourceCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceAssetId"],
        message: "Cinematic source mode requires one owned project asset or render version.",
      });
    }
  });

const schema = z.object({
  prompt: z.string().min(3).max(2000),
  imageUrl: z.string().optional(),
  endImageUrl: z.string().optional(),
  durationSec: z.number().min(1).max(600).default(10),
  customSeconds: z.number().min(1).max(60).optional(),
  aspect: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  quality: z.enum(["720p", "1080p", "4K", "8K"]).default("1080p"),
  frameRate: z.union([z.literal(24), z.literal(30), z.literal(60)]).default(24),
  cameraMove: z
    .enum([
      "static",
      "zoom_in",
      "zoom_out",
      "pan_left",
      "pan_right",
      "tilt_up",
      "tilt_down",
      "slow_mo",
      "orbit",
    ])
    .default("static"),
  style: z
    .enum(["cinematic", "cartoon", "anime", "realistic"])
    .default("cinematic"),
  emotionMode: z
    .enum(["neutral", "joy", "drama", "epic", "calm", "inspiring"])
    .default("epic"),
  autoEnhance: z.boolean().default(true),
  identityLocked: z.boolean().default(false),
  locale: z.string().optional(),
  mediaKind: z.enum(["image", "video"]).default("video"),
  alnabiyKey: z.string().optional().nullable(),
  clientBalance: z.number().optional(),
  /** Video yoki image engine (UI image da ham `engine` yuboradi) */
  engine: z.enum(ENGINE_IDS).optional(),
  imageEngine: z.enum(["flux-pro", "sd3.5-large", "auto"]).optional(),
  bgmMode: z.enum(["ai", "manual", "off"]).optional().default("ai"),
  bgmTrackId: z.string().max(200).optional().nullable(),
  projectId: z.string().min(1).max(100).optional().nullable(),
  shotId: z.string().min(1).max(100).optional().nullable(),
  cinematicControls: cinematicControlsSchema.optional(),
});

async function parseBody(req: NextRequest) {
  const raw = await req.text();
  if (!raw.trim()) {
    throw new SyntaxError("Empty body");
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new SyntaxError("Invalid JSON body");
  }
  return schema.parse(json);
}

/**
 * Atomic CoinLedger charge → Generation QUEUED → Inngest/local worker.
 * Poll: GET /api/generations/[id]/status
 * Har doim application/json qaytaradi (HTML error page emas).
 */
export async function POST(req: NextRequest) {
  try {
    const blocked = await guardSensitiveRequest(req);
    if (blocked) return blocked;

    const body = await parseBody(req);
    const instant = shouldInstantMockGenerate();
    if (instant) {
      try {
        ensureMockAssetPath(body.mediaKind === "image" ? "image" : "video");
      } catch (assetErr) {
        console.warn("[Al-Nabi] mock fixture ensure skipped", assetErr);
      }
    }

    const ensured = await ensureRequestLedgerUser({
      alnabiyKey: body.alnabiyKey,
      allowGuest: isSoftAuthEnabled(),
      request: req,
    });
    if (!ensured) {
      return apiError(
        "Sign in or provide alnabiyKey — generation requires a ledger account",
        { status: 401, code: "AUTH_REQUIRED" }
      );
    }
    const user = ensured.user;
    const genLimited = await guardGenerationLoad(user.id);
    if (genLimited) return genLimited;

    let routing:
      | ReturnType<typeof getVideoGenerationEstimate>
      | undefined;
    if (body.mediaKind === "video") {
      const cinematicControls = body.cinematicControls;
      const sourceVideoId =
        cinematicControls?.sourceAssetId ||
        cinematicControls?.sourceRenderVersionId ||
        undefined;
      try {
        routing = getVideoGenerationEstimate({
          engine: body.engine || "auto",
          imageUrl: body.imageUrl,
          endImageUrl: body.endImageUrl,
          durationSec: body.customSeconds || body.durationSec,
          aspect: body.aspect,
          quality: body.quality,
          frameRate: body.frameRate,
          cameraMove: body.cameraMove,
          sourceVideoId,
          cinematicControls: cinematicControls
            ? {
                videoToVideo: cinematicControls.mode === "video-to-video",
                continuation: cinematicControls.mode === "continuation",
                seed: cinematicControls.seed,
                audioMix: cinematicControls.audioMix,
              }
            : undefined,
        });
      } catch (routingError) {
        if (routingError instanceof ProviderRoutingError) {
          return apiError(routingError.message, {
            status: 422,
            code: routingError.code,
          });
        }
        throw routingError;
      }
      if (shouldRejectUnconfiguredProvider(routing.configured)) {
        return apiError(
          "The selected provider route is not configured for commercial use.",
          {
            status: 503,
            code:
              routing.commercialRoute === "direct"
                ? "PROVIDER_ADAPTER_UNAVAILABLE"
                : "PROVIDER_NOT_CONFIGURED",
          }
        );
      }
    }

    const trustFailure = await enforceGenerationTrust({
      userId: user.id,
      surface: "generate",
      text: body.prompt,
      hasReferenceMedia: Boolean(
        body.imageUrl ||
          body.endImageUrl ||
          body.cinematicControls?.sourceAssetId ||
          body.cinematicControls?.sourceRenderVersionId
      ),
    });
    if (trustFailure) {
      return apiError(trustFailure.message, {
        status:
          trustFailure.code === "SAFETY_UNAVAILABLE" ||
          trustFailure.code === "TRUST_UNAVAILABLE"
            ? 503
            : trustFailure.code === "CONSENT_REQUIRED"
              ? 428
              : trustFailure.code === "ENTITLEMENT_REQUIRED"
                ? 403
                : 422,
        code: trustFailure.code,
        extra: trustFailure.missingConsents
          ? { missingConsents: trustFailure.missingConsents }
          : undefined,
      });
    }

    /* The shared gate has already evaluated this deterministic normalizer. */
    const gate = AlnabiySentinelEngine.processInput(body.prompt);

    const requestedDuration = body.customSeconds || body.durationSec || CLIP_DURATION_SEC;
    const duration =
      body.mediaKind === "video" && routing
        ? routing.effectiveDurationSec
        : chargeableDurationSec(
            "prompt_to_video",
            requestedDuration,
            CLIP_DURATION_SEC
          );
    const kind =
      body.mediaKind === "image" ? "image" : "prompt_to_video";

    const locale = resolveLocale(body.locale);
    const localeName = t(locale, "ai_locale_name");

    const costEngine =
      body.mediaKind === "image"
        ? body.imageEngine || body.engine || "auto"
        : routing?.engineId || body.engine || "auto";
    const costOpts = {
      engine: costEngine,
      quality: body.quality === "8K" ? "4K" : body.quality,
      frameRate: body.frameRate,
      clipMaxSec: body.mediaKind === "video" ? duration : undefined,
    };

    /* Preflight only — NC is NOT debited until the provider call starts. */
    const preflight = await assertSufficientCoins({
      userId: user.id,
      kind,
      durationSec: body.mediaKind === "image" ? 1 : duration,
      costOpts,
    });
    if (!preflight.ok) {
      return apiJson(
        {
          success: false,
          ok: false,
          error: preflight.message,
          code: preflight.code,
          cost: preflight.cost,
          required: preflight.required ?? preflight.cost,
          balanceAfter: preflight.balanceAfter,
        },
        {
          status:
            preflight.code === "INSUFFICIENT"
              ? 402
              : preflight.code === "BANNED"
                ? 403
                : 400,
        }
      );
    }
    const expectedCost = preflight.cost;

    let enhanced = gate.renderPrompt;
    if (body.autoEnhance) {
      try {
        enhanced = await enhancePrompt(
          gate.renderPrompt,
          body.style,
          localeName
        );
      } catch {
        enhanced = gate.renderPrompt;
      }
    }
    const mood = `Emotional mode: ${body.emotionMode}.`;
    enhanced = `${enhanced}. ${mood} ${gate.brandTag}.`;

    let generation;
    try {
      generation = await prisma.$transaction(async (tx) => {
        const workspace = await ensureStudioWorkspace(tx, {
          userId: user.id,
          projectId: body.projectId,
          shotId: body.shotId,
          aspect: body.aspect,
          prompt: body.prompt,
        });

        if (
          body.cinematicControls &&
          body.cinematicControls.mode !== "standard"
        ) {
          const sourceAssetId = body.cinematicControls?.sourceAssetId;
          const sourceRenderVersionId =
            body.cinematicControls?.sourceRenderVersionId;
          const source = sourceAssetId
            ? await tx.projectAsset.findFirst({
                where: {
                  id: sourceAssetId,
                  projectId: workspace.projectId,
                  userId: user.id,
                  kind: "VIDEO",
                },
                select: { id: true },
              })
            : await tx.renderVersion.findFirst({
                where: {
                  id: sourceRenderVersionId || "",
                  projectId: workspace.projectId,
                  status: { in: ["COMPLETED", "APPROVED"] },
                },
                select: { id: true },
              });
          if (!source) throw new Error("CINEMATIC_SOURCE_NOT_FOUND");
        }

        await reserveProjectSpend(tx, {
          projectId: workspace.projectId,
          userId: user.id,
          credits: expectedCost,
        });

        const created = await tx.generation.create({
          data: {
            userId: user.id,
            type: resolveGenerationType({
              mediaKind: body.mediaKind,
              imageUrl: body.imageUrl,
              endImageUrl: body.endImageUrl,
            }),
            status: "QUEUED",
            prompt: body.prompt,
            enhancedPrompt: enhanced,
            style: body.style,
            emotionMode: body.emotionMode,
            quality: body.quality === "8K" ? "4K" : body.quality,
            durationSec: body.mediaKind === "image" ? 0 : duration,
            cameraMove: body.cameraMove,
            sourceImageUrl: body.imageUrl || null,
            identityLocked: body.identityLocked,
            projectId: workspace.projectId,
            shotId: workspace.shotId,
            reservedCredits: expectedCost,
            scenesJson: {
              aspect: body.aspect,
              engine:
                body.mediaKind === "image"
                  ? body.imageEngine || body.engine || "auto"
                  : routing?.engineId || body.engine || "auto",
              imageEngine: body.imageEngine || body.engine || "auto",
              frameRate: body.frameRate,
              bgmMode: body.bgmMode || "ai",
              bgmTrackId: body.bgmTrackId || null,
              endImageUrl: body.endImageUrl || null,
              sourceVideoId:
                body.cinematicControls?.sourceAssetId ||
                body.cinematicControls?.sourceRenderVersionId ||
                null,
              cinematicControls: body.cinematicControls
                ? {
                    mode: body.cinematicControls.mode,
                    seed: body.cinematicControls.seed || null,
                    audioMix: body.cinematicControls.audioMix || null,
                  }
                : null,
              routing: routing
                ? {
                    effectiveDurationSec: routing.effectiveDurationSec,
                    commercialRoute: routing.commercialRoute,
                    expectedLatencySeconds: routing.expectedLatencySeconds,
                  }
                : undefined,
            },
          },
        });

        const number =
          (await tx.renderVersion.count({
            where: workspace.shotId
              ? { shotId: workspace.shotId }
              : { projectId: workspace.projectId },
          })) + 1;
        const renderVersion = await tx.renderVersion.create({
          data: {
            projectId: workspace.projectId,
            shotId: workspace.shotId,
            generationId: created.id,
            number,
            status: "QUEUED",
            estimatedCredits: expectedCost,
          },
        });
        await tx.modelRun.create({
          data: {
            projectId: workspace.projectId,
            renderVersionId: renderVersion.id,
            generationId: created.id,
            provider: routing?.provider || "replicate",
            engineId: String(costEngine),
            endpointModel: routing?.endpointModel || null,
            commercialRoute: routing?.commercialRoute || "replicate",
            status: "QUEUED",
            estimatedCredits: expectedCost,
            expectedP50Sec: routing?.expectedLatencySeconds.p50 || null,
            expectedP90Sec: routing?.expectedLatencySeconds.p90 || null,
            requestMetadata: {
              durationSec: body.mediaKind === "image" ? 0 : duration,
              aspect: body.aspect,
              quality: body.quality === "8K" ? "4K" : body.quality,
              hasFirstFrame: Boolean(body.imageUrl),
              hasLastFrame: Boolean(body.endImageUrl),
            },
          },
        });
        await tx.project.update({
          where: { id: workspace.projectId },
          data: { status: "ACTIVE" },
        });
        return created;
      });
    } catch (projectError) {
      if (projectError instanceof ProjectSpendCapError) {
        return apiError("This project has reached its spend cap.", {
          status: 409,
          code: "PROJECT_SPEND_CAP",
          extra: { expectedCost },
        });
      }
      if (
        projectError instanceof Error &&
        (projectError.message === "PROJECT_NOT_FOUND" ||
          projectError.message === "SHOT_NOT_FOUND" ||
          projectError.message === "CINEMATIC_SOURCE_NOT_FOUND")
      ) {
        return apiError(
          projectError.message === "SHOT_NOT_FOUND"
            ? "Shot not found in this project."
            : projectError.message === "CINEMATIC_SOURCE_NOT_FOUND"
              ? "Cinematic source is not an owned completed project video."
              : "Project not found.",
          {
            status: 404,
            code: projectError.message,
          }
        );
      }
      throw projectError;
    }

    let queueMode: "inngest" | "local" | "sync" = "local";
    let status: "QUEUED" | "COMPLETED" | "FAILED" = "QUEUED";
    let resultUrl: string | null = null;
    let r2Key: string | null = null;
    let balanceAfter: number = user.coins;
    let creditsCost = 0;
    let receiptId: string | undefined;
    let publicError: string | null = null;
    let errorCode: string | null = null;
    let pipelineStage: string | null = null;
    let pipelineLog: PipelineLogEntry[] = [];
    let recovered = false;
    const routeTrace = createPipelineTrace(generation.id);
    routeTrace.ok(
      "queue",
      instant ? "Sync mock generate accepted" : "Generation enqueued"
    );

    if (instant) {
      /* Test/local: sync — charge happens inside processGenerationJob
       * immediately before provider/mock paid work. */
      try {
        const { processGenerationJob } = await import(
          "@/lib/generation/process"
        );
        const done = await processGenerationJob(generation.id);
        queueMode = "sync";
        if (typeof done.balanceAfter === "number") {
          balanceAfter = done.balanceAfter;
        }
        if (typeof done.creditsCost === "number") {
          creditsCost = done.creditsCost;
        }
        if (done.pipelineLog?.length) {
          pipelineLog = done.pipelineLog;
        }
        recovered = Boolean(done.recovered);
        if (done.ok && done.resultUrl) {
          status = "COMPLETED";
          resultUrl = done.resultUrl;
        } else {
          status = "FAILED";
          const classified = classifyGenerationFailure(
            done.error || "Generation failed. Credits were refunded if charged.",
            (done.pipelineStage as "queue" | "mock-persist") || "mock-persist"
          );
          publicError = classified.message;
          errorCode = done.errorCode || classified.code;
          pipelineStage = done.pipelineStage || classified.stage;
          if (!pipelineLog.length) {
            routeTrace.error(
              classified.stage,
              classified.message,
              classified.code
            );
            pipelineLog = routeTrace.entries;
          }
        }
      } catch (syncErr) {
        const classified = classifyGenerationFailure(syncErr, "mock-persist");
        console.error(
          "[Al-Nabi][pipeline][mock-persist] sync generate failed",
          generation.id,
          classified.code,
          classified.message,
          syncErr
        );
        const { failAndRefundGeneration } = await import(
          "@/lib/generation/fail-and-refund"
        );
        const refunded = await failAndRefundGeneration({
          generationId: generation.id,
          error: syncErr,
          errorCode: classified.code,
          area: "generate-sync",
        });
        if (typeof refunded.balanceAfter === "number") {
          balanceAfter = refunded.balanceAfter;
        }
        status = "FAILED";
        publicError = classified.message;
        errorCode = classified.code;
        pipelineStage = classified.stage;
        routeTrace.error(classified.stage, classified.message, classified.code);
        pipelineLog = routeTrace.entries;
      }
    } else {
      try {
        const queue = await enqueueGeneration(generation.id);
        queueMode = queue.mode;
        /* Not charged yet — worker debits right before provider. */
        creditsCost = 0;
        balanceAfter = user.coins;
      } catch (queueErr) {
        const classified = classifyGenerationFailure(queueErr, "queue");
        console.error(
          "[Al-Nabi][pipeline][queue] enqueue failed",
          generation.id,
          classified.code,
          classified.message,
          queueErr
        );
        const refunded = await failAndRefundGeneration({
          generationId: generation.id,
          error: queueErr,
          errorCode: classified.code,
          area: "generate-enqueue",
        });
        status = "FAILED";
        publicError = classified.message;
        errorCode = classified.code;
        pipelineStage = classified.stage;
        routeTrace.error(classified.stage, classified.message, classified.code);
        pipelineLog = routeTrace.entries;
      }
    }

    if (status === "FAILED" && !publicError) {
      const failedRow = await prisma.generation.findUnique({
        where: { id: generation.id },
        select: { errorMessage: true },
      });
      const classified = classifyGenerationFailure(
        failedRow?.errorMessage ||
          "Generation failed. Credits were refunded if charged.",
        "queue"
      );
      publicError = classified.message;
      errorCode = errorCode || classified.code;
      pipelineStage = pipelineStage || classified.stage;
    }

    if (
      status !== "COMPLETED" &&
      instant &&
      isRecoverableLocalMockFailure(errorCode)
    ) {
      const mediaKind = body.mediaKind === "image" ? "image" : "video";
      try {
        ensureMockAssetPath(mediaKind);
      } catch {
        /* in-memory / public fallback still playable */
      }
      const fallback = localFallbackMedia(mediaKind);
      try {
        await prisma.generation.update({
          where: { id: generation.id },
          data: {
            status: "COMPLETED",
            resultUrl: fallback,
            errorMessage: null,
          },
        });
      } catch {
        /* still return a playable payload */
      }
      recovered = true;
      status = "COMPLETED";
      resultUrl = fallback;
      publicError = null;
      errorCode = null;
      pipelineStage = "mock-persist";
      routeTrace.recovered(
        "mock-persist",
        "Local mock preview delivered without a provider key",
        "EMPTY_RESULT"
      );
      pipelineLog = routeTrace.entries;
    }

    if (status === "COMPLETED" && resultUrl) {
      const row = await prisma.generation.findUnique({
        where: { id: generation.id },
        select: { r2Key: true, resultUrl: true, creditsCost: true },
      });
      r2Key = row?.r2Key || null;
      if (!instant) {
        resultUrl =
          (await resolvePrivateDeliveryUrl({
            objectKey: r2Key,
            resultUrl: row?.resultUrl || resultUrl,
          })) || resultUrl;
      }
      if (row && row.creditsCost > 0) creditsCost = row.creditsCost;
    }

    const fallbackUrl =
      instant
        ? localFallbackMedia(body.mediaKind === "image" ? "image" : "video")
        : undefined;
    const playableUrl =
      resultUrl || (recovered || status === "COMPLETED" ? fallbackUrl : null);
    const failedFields =
      status === "FAILED"
        ? failedGenerateErrorFields({ publicError, errorCode })
        : null;

    const payload = sanitizePublicPayload({
      success: status !== "FAILED",
      ok: status !== "FAILED",
      queued: status === "QUEUED",
      failed: status === "FAILED",
      recovered,
      instantMock: instant,
      generationId: generation.id,
      jobId: generation.id,
      status,
      done: status === "COMPLETED",
      error: failedFields?.error ?? null,
      errorMessage: failedFields?.errorMessage ?? null,
      errorCode: failedFields?.errorCode ?? errorCode ?? null,
      pipelineStage: pipelineStage || undefined,
      pipelineLog,
      fallbackUrl,
      resultUrl: playableUrl,
      videoUrl:
        body.mediaKind !== "image" &&
        (status === "COMPLETED" || recovered)
          ? playableUrl
          : null,
      imageUrl:
        body.mediaKind === "image" &&
        (status === "COMPLETED" || recovered)
          ? playableUrl
          : null,
      r2Key,
      statusUrl: `/api/generations/${generation.id}/status`,
      projectId: generation.projectId,
      shotId: generation.shotId,
      queueMode,
      expectedCost,
      creditsCost,
      creditsPending: status === "QUEUED" && creditsCost === 0,
      balanceAfter,
      alnabiyKey: user.alnabiyKey,
      alnabiy_key: user.alnabiyKey,
      guestSession: ensured.guestCreated,
      receiptId,
      watermark: WATERMARK,
      clipDurationSec: CLIP_DURATION_SEC,
      emotionMode: body.emotionMode,
      aspect: body.aspect,
      quality: body.quality === "8K" ? "4K" : body.quality,
      routing: routing
        ? {
            effectiveDurationSec: routing.effectiveDurationSec,
            durationAdjusted: routing.durationAdjusted,
            estimatedCredits: routing.estimatedCredits,
            estimatedProviderCostUsd: routing.estimatedProviderCostUsd,
            expectedLatencySeconds: routing.expectedLatencySeconds,
            commercialRoute: routing.commercialRoute,
            nativeAudio: routing.nativeAudio,
          }
        : undefined,
    });

    const res = apiJson(payload);

    if (ensured.guestCreated) {
      try {
        attachSessionCookie(res, { id: user.id, email: user.email });
      } catch (cookieErr) {
        console.warn("[Alnabiy] session cookie attach failed", cookieErr);
      }
    }
    return res;
  } catch (e) {
    if (e instanceof SentinelBlockedError) {
      return apiJson(
        {
          success: false,
          ok: false,
          code: "SENTINEL_BLOCKED",
          error: e.message,
        },
        { status: 422 }
      );
    }

    const formatted = formatRouteError(e);
    const classified = classifyGenerationFailure(e, "queue");
    console.error(
      "[Al-Nabi][pipeline][queue] /api/generate",
      classified.code,
      classified.message,
      e
    );

    try {
      const Sentry = await import("@sentry/nextjs");
      Sentry.captureException(e);
    } catch {
      /* soft */
    }

    return apiError(classified.message, {
      status: formatted.status,
      code: classified.code !== "QUEUE_FAILED" ? classified.code : formatted.code,
      extra: {
        errorCode: classified.code,
        errorMessage: classified.message,
        pipelineStage: classified.stage,
        pipelineLog: [
          {
            at: new Date().toISOString(),
            stage: classified.stage,
            status: "error" as const,
            code: classified.code,
            message: classified.message,
          },
        ],
        ...(formatted.details ? { details: formatted.details } : {}),
      },
    });
  }
}

/** GET — health / method hint (HTML 404 o‘rniga JSON) */
export async function GET() {
  return apiJson({
    success: true,
    ok: true,
    endpoint: "/api/generate",
    method: "POST",
  });
}
