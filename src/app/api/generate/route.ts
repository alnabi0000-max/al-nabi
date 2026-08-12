import { NextRequest } from "next/server";
import { z } from "zod";
import { enhancePrompt, SentinelBlockedError } from "@/lib/llm";
import { CLIP_DURATION_SEC } from "@/lib/video-provider";
import { AlnabiySentinelEngine } from "@/lib/sentinel-engine";
import { WATERMARK, chargeableDurationSec } from "@/lib/credits";
import { t, resolveLocale } from "@/lib/i18n/messages";
import { prisma } from "@/lib/prisma";
import { atomicChargeCoins } from "@/lib/ledger/atomic";
import { enqueueGeneration } from "@/lib/generation/enqueue";
import { sanitizePublicPayload } from "@/lib/models";
import type { GenerationType } from "@prisma/client";
import { guardSensitiveRequest } from "@/lib/security/request-guard";
import { moderateText } from "@/lib/security/moderation";
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

const schema = z.object({
  prompt: z.string().min(3).max(2000),
  imageUrl: z.string().optional(),
  durationSec: z.number().min(1).max(600).default(8),
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
});

function generationType(mediaKind: "image" | "video"): GenerationType {
  return mediaKind === "image" ? "IMAGE" : "TEXT_TO_VIDEO";
}

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

    const gate = AlnabiySentinelEngine.processInput(body.prompt);
    if (!gate.isSafe) {
      return apiJson(
        {
          success: false,
          ok: false,
          code: "SENTINEL_BLOCKED",
          error: gate.rejectionReason || "Content blocked",
          brandTag: gate.brandTag,
        },
        { status: 422 }
      );
    }

    try {
      const moderation = await moderateText(body.prompt);
      if (!moderation.allowed) {
        return apiJson(
          {
            success: false,
            ok: false,
            code: "MODERATION_BLOCKED",
            error: moderation.reason || "Content rejected by moderation",
            categories: moderation.categories,
          },
          { status: 422 }
        );
      }
    } catch (modErr) {
      console.warn("[Alnabiy] moderation skipped", modErr);
    }

    const requestedDuration =
      body.customSeconds || body.durationSec || CLIP_DURATION_SEC;
    const duration = chargeableDurationSec(
      "prompt_to_video",
      requestedDuration,
      CLIP_DURATION_SEC
    );
    const kind =
      body.mediaKind === "image" ? "image" : "prompt_to_video";

    const locale = resolveLocale(body.locale);
    const localeName = t(locale, "ai_locale_name");

    const ensured = await ensureRequestLedgerUser({
      alnabiyKey: body.alnabiyKey,
      allowGuest: isSoftAuthEnabled(),
    });

    if (!ensured) {
      return apiError(
        "Sign in or provide alnabiyKey — generation requires a ledger account",
        { status: 401, code: "AUTH_REQUIRED" }
      );
    }
    const user = ensured.user;

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

    const generation = await prisma.generation.create({
      data: {
        userId: user.id,
        type: generationType(body.mediaKind),
        status: "QUEUED",
        prompt: body.prompt,
        enhancedPrompt: enhanced,
        style: body.style,
        emotionMode: body.emotionMode,
        quality: body.quality,
        durationSec: body.mediaKind === "image" ? 0 : duration,
        cameraMove: body.cameraMove,
        sourceImageUrl: body.imageUrl || null,
        identityLocked: body.identityLocked,
        scenesJson: {
          aspect: body.aspect,
          engine:
            body.mediaKind === "image"
              ? body.imageEngine || body.engine || "auto"
              : body.engine || "auto",
          imageEngine: body.imageEngine || body.engine || "auto",
          frameRate: body.frameRate,
        },
      },
    });

    const costEngine =
      body.mediaKind === "image"
        ? body.imageEngine || body.engine || "auto"
        : body.engine || "auto";

    const charge = await atomicChargeCoins({
      userId: user.id,
      kind,
      durationSec: body.mediaKind === "image" ? 1 : duration,
      generationId: generation.id,
      reason: `generate:${kind}:${costEngine}`,
      costOpts: {
        engine: costEngine,
        quality: body.quality,
        frameRate: body.frameRate,
      },
    });

    if (!charge.ok) {
      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: "FAILED",
          errorMessage: charge.message,
        },
      });
      return apiJson(
        {
          success: false,
          ok: false,
          error: charge.message,
          code: charge.code,
          cost: charge.cost,
          required: charge.required ?? charge.cost,
          balanceAfter: charge.balanceAfter,
          generationId: generation.id,
        },
        {
          status:
            charge.code === "INSUFFICIENT"
              ? 402
              : charge.code === "BANNED"
                ? 403
                : 400,
        }
      );
    }

    const { shouldInstantMockGenerate } = await import(
      "@/lib/generation/dev-mock"
    );
    const instant = shouldInstantMockGenerate();

    let queueMode: "inngest" | "local" | "sync" = "local";
    let status: "QUEUED" | "COMPLETED" | "FAILED" = "QUEUED";
    let resultUrl: string | null = null;
    let r2Key: string | null = null;
    /** Prefer post-refund balance when generation fails after charge. */
    let balanceAfter: number = charge.balanceAfter;

    if (instant) {
      /* Test/local: sync mock — polling timeout bo‘lmasin */
      try {
        const { processGenerationJob } = await import(
          "@/lib/generation/process"
        );
        const done = await processGenerationJob(generation.id);
        queueMode = "sync";
        if (done.ok && done.resultUrl) {
          status = "COMPLETED";
          resultUrl = done.resultUrl;
        } else {
          status = "FAILED";
        }
      } catch (syncErr) {
        console.warn("[Alnabiy] sync mock generate failed", syncErr);
        const { failAndRefundGeneration } = await import(
          "@/lib/generation/fail-and-refund"
        );
        const refunded = await failAndRefundGeneration({
          generationId: generation.id,
          error: syncErr,
          area: "generate-sync",
        });
        if (typeof refunded.balanceAfter === "number") {
          balanceAfter = refunded.balanceAfter;
        }
        status = "FAILED";
      }
    } else {
      try {
        const queue = await enqueueGeneration(generation.id);
        queueMode = queue.mode;
      } catch (queueErr) {
        console.warn("[Alnabiy] enqueue failed — refunding", queueErr);
        const { failAndRefundGeneration } = await import(
          "@/lib/generation/fail-and-refund"
        );
        const refunded = await failAndRefundGeneration({
          generationId: generation.id,
          error: queueErr,
          area: "generate-enqueue",
          reason: "rollback:enqueue_failed",
        });
        if (typeof refunded.balanceAfter === "number") {
          balanceAfter = refunded.balanceAfter;
        }
        status = "FAILED";
      }
    }

    if (status === "COMPLETED" && resultUrl) {
      const row = await prisma.generation.findUnique({
        where: { id: generation.id },
        select: { r2Key: true, resultUrl: true },
      });
      r2Key = row?.r2Key || null;
      resultUrl = row?.resultUrl || resultUrl;
    }

    /* Sync mock can fail inside processGenerationJob without throwing —
     * ensure FAILED jobs are refunded and balanceAfter is post-refund. */
    if (status === "FAILED" && instant) {
      const { failAndRefundGeneration } = await import(
        "@/lib/generation/fail-and-refund"
      );
      const refunded = await failAndRefundGeneration({
        generationId: generation.id,
        error: "Sync generation failed",
        area: "generate-sync-status",
      });
      if (typeof refunded.balanceAfter === "number") {
        balanceAfter = refunded.balanceAfter;
      }
    }

    const payload = sanitizePublicPayload({
      success: status !== "FAILED",
      ok: status !== "FAILED",
      queued: status === "QUEUED",
      generationId: generation.id,
      jobId: generation.id,
      status,
      done: status === "COMPLETED",
      resultUrl,
      videoUrl:
        status === "COMPLETED" && body.mediaKind !== "image" ? resultUrl : null,
      imageUrl:
        status === "COMPLETED" && body.mediaKind === "image" ? resultUrl : null,
      r2Key,
      statusUrl: `/api/generations/${generation.id}/status`,
      queueMode,
      creditsCost: charge.cost,
      balanceAfter,
      alnabiyKey: user.alnabiyKey,
      alnabiy_key: user.alnabiyKey,
      guestSession: ensured.guestCreated,
      receiptId: charge.receiptId,
      watermark: WATERMARK,
      clipDurationSec: CLIP_DURATION_SEC,
      emotionMode: body.emotionMode,
      aspect: body.aspect,
      quality: body.quality,
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
    console.error("[Alnabiy] /api/generate error:", formatted.message, e);

    try {
      const Sentry = await import("@sentry/nextjs");
      Sentry.captureException(e);
    } catch {
      /* soft */
    }

    return apiError(formatted.message, {
      status: formatted.status,
      code: formatted.code,
      extra: formatted.details ? { details: formatted.details } : undefined,
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
