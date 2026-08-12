import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiJson, formatRouteError } from "@/lib/api/json-response";
import { sanitizeGenerationError } from "@/lib/generation/public-error";
import { renderProducerPackage } from "@/lib/producer/render";
import type { VisualDna } from "@/lib/producer/vision-dna";
import { guardSensitiveRequest } from "@/lib/security/request-guard";
import { ALNABIY_ENGINES } from "@/lib/models";
import {
  ensureRequestLedgerUser,
  isSoftAuthEnabled,
} from "@/lib/auth/ensure-request-user";
import { atomicChargeCoins, atomicRollbackCoins } from "@/lib/ledger/atomic";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const schema = z.object({
  brief: z.string().min(3).max(4000),
  voiceScript: z.string().max(2000).optional(),
  aspect: z.enum(["16:9", "9:16", "1:1"]).optional(),
  narration: z
    .enum(["neutral", "joy", "drama", "epic", "calm", "inspiring"])
    .optional(),
  visualDna: z.any().optional().nullable(),
  durationSec: z.number().min(5).max(20).optional(),
  alnabiyKey: z.string().optional().nullable(),
});

/**
 * Full package: video + Al-Nabi Audio Engine VO + Foley → final MP4.
 * Requires auth + ledger charge (video + VO + Foley is a full paid render).
 */
export async function POST(req: NextRequest) {
  let chargedUserId: string | null = null;
  let chargedAmount = 0;
  let generationId: string | null = null;
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
        "Sign in or provide alnabiyKey — render requires a ledger account",
        { status: 401, code: "AUTH_REQUIRED" }
      );
    }
    const user = ensured.user;
    const durationSec = body.durationSec || 8;

    const generation = await prisma.generation.create({
      data: {
        userId: user.id,
        type: "TEXT_TO_VIDEO",
        status: "QUEUED",
        prompt: body.brief,
        durationSec,
      },
    });
    generationId = generation.id;

    const charge = await atomicChargeCoins({
      userId: user.id,
      kind: "text_to_movie",
      durationSec,
      generationId: generation.id,
      reason: "producer:render",
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
        { status: charge.code === "INSUFFICIENT" ? 402 : charge.code === "BANNED" ? 403 : 400 }
      );
    }
    chargedUserId = user.id;
    chargedAmount = charge.cost;

    const result = await renderProducerPackage({
      brief: body.brief,
      voiceScript: body.voiceScript,
      aspect: body.aspect,
      narration: body.narration,
      visualDna: (body.visualDna as VisualDna | null) || null,
      durationSec: body.durationSec,
      jobId: generation.id,
    });

    if (!result.ok) {
      await atomicRollbackCoins({
        userId: user.id,
        amount: charge.cost,
        generationId: generation.id,
        reason: "rollback:producer_render_failed",
      });
      await prisma.generation.update({
        where: { id: generation.id },
        data: { status: "FAILED", errorMessage: result.error || "Produce failed" },
      });
      return apiError(
        sanitizeGenerationError(result.error || "Produce failed"),
        { status: 500, code: "PRODUCE_FAILED" }
      );
    }

    await prisma.generation.update({
      where: { id: generation.id },
      data: { status: "COMPLETED", resultUrl: result.videoUrl },
    });

    return apiJson({
      success: true,
      ok: true,
      jobId: result.jobId,
      videoUrl: result.videoUrl,
      foleyCount: result.foleyCount,
      engine: ALNABIY_ENGINES.gateway,
      audioEngine: ALNABIY_ENGINES.voice,
      promptUsed: result.promptUsed,
      creditsCost: charge.cost,
      balanceAfter: charge.balanceAfter,
      message:
        "Final cut ready — picture, voice, and micro sound design in one file.",
    });
  } catch (e) {
    if (chargedUserId && generationId) {
      await atomicRollbackCoins({
        userId: chargedUserId,
        amount: chargedAmount,
        generationId,
        reason: "rollback:producer_render_error",
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
