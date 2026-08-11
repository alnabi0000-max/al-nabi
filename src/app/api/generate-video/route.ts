import { NextRequest } from "next/server";
import { z } from "zod";
import { enhancePrompt } from "@/lib/llm";
import { generateVideoClip } from "@/lib/video-provider";
import { WATERMARK } from "@/lib/credits";
import { sanitizePublicPayload, whiteLabelEngine, whiteLabelModel } from "@/lib/models";
import { apiError, apiJson, formatRouteError } from "@/lib/api/json-response";
import { sanitizeGenerationError } from "@/lib/generation/public-error";
import { guardSensitiveRequest } from "@/lib/security/request-guard";
import {
  ensureRequestLedgerUser,
  isSoftAuthEnabled,
} from "@/lib/auth/ensure-request-user";
import { atomicChargeCoins, atomicRollbackCoins } from "@/lib/ledger/atomic";
import { prisma } from "@/lib/prisma";

/**
 * Legacy sync video route — prefer POST /api/generate (ledger + queue + refund).
 * Kept for compatibility; requires auth + ledger charge like /api/generate.
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
    });
    if (!ensured) {
      return apiError(
        "Sign in or provide alnabiyKey — generation requires a ledger account",
        { status: 401, code: "AUTH_REQUIRED" }
      );
    }
    const user = ensured.user;

    const generation = await prisma.generation.create({
      data: {
        userId: user.id,
        type: "TEXT_TO_VIDEO",
        status: "QUEUED",
        prompt: body.prompt,
        style: body.style,
        durationSec: body.durationSec,
        cameraMove: body.cameraMove,
        sourceImageUrl: body.imageUrl || null,
      },
    });
    generationId = generation.id;

    const charge = await atomicChargeCoins({
      userId: user.id,
      kind: "prompt_to_video",
      durationSec: body.durationSec,
      generationId: generation.id,
      reason: "generate-video:legacy",
    });

    if (!charge.ok) {
      await prisma.generation.update({
        where: { id: generation.id },
        data: { status: "FAILED", errorMessage: charge.message },
      });
      return apiJson(
        { ok: false, success: false, error: charge.message, code: charge.code },
        { status: charge.code === "INSUFFICIENT" ? 402 : charge.code === "BANNED" ? 403 : 400 }
      );
    }
    chargedUserId = user.id;
    chargedAmount = charge.cost;

    const prompt = body.autoEnhance
      ? await enhancePrompt(body.prompt, body.style)
      : body.prompt;

    const result = await generateVideoClip({
      prompt,
      imageUrl: body.imageUrl,
      cameraMove: body.cameraMove,
    });

    await prisma.generation.update({
      where: { id: generation.id },
      data: { status: "COMPLETED", resultUrl: result.url },
    });

    return apiJson(
      sanitizePublicPayload({
        ok: true,
        success: true,
        videoUrl: result.url,
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
    const formatted = formatRouteError(e);
    return apiError(sanitizeGenerationError(e, formatted.message), {
      status: formatted.status || 500,
      code: formatted.code,
    });
  }
}
