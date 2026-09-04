import { NextRequest } from "next/server";
import { z } from "zod";
import { enhancePrompt } from "@/lib/llm";
import { generateVideoClip } from "@/lib/video-provider";
import { WATERMARK, chargeableDurationSec } from "@/lib/credits";
import { sanitizePublicPayload, whiteLabelEngine, whiteLabelModel } from "@/lib/models";
import { apiError, apiJson, formatRouteError } from "@/lib/api/json-response";
import { sanitizeGenerationError } from "@/lib/generation/public-error";
import { guardSensitiveRequest, guardGenerationLoad } from "@/lib/security/request-guard";
import {
  ensureRequestLedgerUser,
  isSoftAuthEnabled,
} from "@/lib/auth/ensure-request-user";
import {
  assertSufficientCoins,
  atomicChargeCoins,
  atomicRollbackCoins,
} from "@/lib/ledger/atomic";
import { prisma } from "@/lib/prisma";
import {
  assertPersistentObjectStorage,
  ObjectStorageConfigurationError,
  persistRemoteAsset,
} from "@/lib/storage/object-storage";
import { resolvePrivateDeliveryUrl } from "@/lib/storage/signed-url";
import { enforceGenerationTrust } from "@/lib/trust/generation-gate";
import { resolveGenerationType } from "@/lib/generation/types";

/**
 * Legacy sync video route — prefer POST /api/generate (ledger + queue + refund).
 * Charge happens only immediately before the provider clip request.
 */
const schema = z.object({
  prompt: z.string().min(3).max(2000),
  imageUrl: z.string().url().optional(),
  durationSec: z.number().min(5).max(600).default(10),
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
  autoEnhance: z.boolean().default(true),
  alnabiyKey: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  let generationId: string | null = null;
  let chargedUserId: string | null = null;
  let chargedAmount = 0;
  try {
    const blocked = await guardSensitiveRequest(req);
    if (blocked) return blocked;

    const body = schema.parse(await req.json());

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
    const trustFailure = await enforceGenerationTrust({
      userId: user.id,
      surface: "generate-video-legacy",
      text: body.prompt,
      hasReferenceMedia: Boolean(body.imageUrl),
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
    assertPersistentObjectStorage();

    const billableDuration = chargeableDurationSec(
      "prompt_to_video",
      body.durationSec
    );

    const preflight = await assertSufficientCoins({
      userId: user.id,
      kind: "prompt_to_video",
      durationSec: billableDuration,
    });
    if (!preflight.ok) {
      return apiJson(
        {
          ok: false,
          success: false,
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

    const generation = await prisma.generation.create({
      data: {
        userId: user.id,
        type: resolveGenerationType({
          mediaKind: "video",
          imageUrl: body.imageUrl,
        }),
        status: "QUEUED",
        prompt: body.prompt,
        style: body.style,
        durationSec: billableDuration,
        cameraMove: body.cameraMove,
        sourceImageUrl: body.imageUrl || null,
      },
    });
    generationId = generation.id;

    const prompt = body.autoEnhance
      ? await enhancePrompt(body.prompt, body.style)
      : body.prompt;

    /* Debit only when we are about to call the paid video provider. */
    const charge = await atomicChargeCoins({
      userId: user.id,
      kind: "prompt_to_video",
      durationSec: billableDuration,
      generationId: generation.id,
      reason: "generate-video:legacy:provider",
    });

    if (!charge.ok) {
      await prisma.generation.update({
        where: { id: generation.id },
        data: { status: "FAILED", errorMessage: charge.message },
      });
      return apiJson(
        {
          ok: false,
          success: false,
          error: charge.message,
          code: charge.code,
          cost: charge.cost,
          required: charge.required ?? charge.cost,
          balanceAfter: charge.balanceAfter,
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
    chargedUserId = user.id;
    chargedAmount = charge.cost;

    await prisma.generation.update({
      where: { id: generation.id },
      data: { status: "GENERATING_VIDEO", errorMessage: null },
    });

    const result = await generateVideoClip({
      prompt,
      imageUrl: body.imageUrl,
      cameraMove: body.cameraMove,
    });
    const stored = await persistRemoteAsset({
      sourceUrl: result.url,
      userId: user.id,
      generationId: generation.id,
      kind: "video",
    });
    const deliveryUrl = await resolvePrivateDeliveryUrl({
      objectKey: stored.key,
      resultUrl: stored.url,
    });
    if (!deliveryUrl) {
      throw new Error("Private media could not be signed for delivery");
    }

    await prisma.generation.update({
      where: { id: generation.id },
      data: {
        status: "COMPLETED",
        resultUrl: stored.url,
        r2Key: stored.key,
      },
    });

    return apiJson(
      sanitizePublicPayload({
        ok: true,
        success: true,
        videoUrl: deliveryUrl,
        provider: whiteLabelEngine(result.provider),
        model: whiteLabelModel(result.model),
        enhancedPrompt: prompt,
        creditsCost: charge.cost,
        balanceAfter: charge.balanceAfter,
        watermark: WATERMARK,
        deprecated: true,
        prefer: "/api/generate",
      })
    );
  } catch (e) {
    if (chargedUserId && generationId) {
      await atomicRollbackCoins({
        userId: chargedUserId,
        amount: chargedAmount,
        generationId,
        reason: "rollback:generate-video_failed",
      }).catch(() => undefined);
      await prisma.generation
        .update({ where: { id: generationId }, data: { status: "FAILED" } })
        .catch(() => undefined);
    }
    if (e instanceof ObjectStorageConfigurationError) {
      return apiError(e.message, { status: 503, code: "MEDIA_UNAVAILABLE" });
    }
    const formatted = formatRouteError(e);
    return apiError(sanitizeGenerationError(e, formatted.message), {
      status: formatted.status || 500,
      code: formatted.code,
    });
  }
}
