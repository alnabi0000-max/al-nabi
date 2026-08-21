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
import {
  assertSufficientCoins,
  atomicChargeCoins,
  atomicRollbackCoins,
} from "@/lib/ledger/atomic";
import { prisma } from "@/lib/prisma";
import { recordInterestFromGeneration } from "@/lib/producer/interest-profile";
import {
  assertFfmpegAvailable,
  FfmpegCapabilityError,
} from "@/lib/ffmpeg-worker";
import {
  assertPersistentObjectStorage,
  ObjectStorageConfigurationError,
  persistRemoteAsset,
} from "@/lib/storage/object-storage";

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
  bgmMode: z.enum(["ai", "manual", "off"]).optional().default("ai"),
  bgmTrackId: z.string().max(200).optional().nullable(),
  alnabiyKey: z.string().optional().nullable(),
});

/**
 * Full package: video + Al-Nabi Audio Engine VO + Foley + ambient BGM → final MP4.
 * NC debit occurs only immediately before the paid video provider call.
 */
export async function POST(req: NextRequest) {
  let chargedUserId: string | null = null;
  let chargedAmount = 0;
  let chargedBalanceAfter: number | undefined;
  let generationId: string | null = null;
  try {
    const blocked = await guardSensitiveRequest(req);
    if (blocked) return blocked;

    const body = schema.parse(await req.json());
    await assertFfmpegAvailable();
    assertPersistentObjectStorage();

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

    const preflight = await assertSufficientCoins({
      userId: user.id,
      kind: "text_to_movie",
      durationSec,
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
        type: "TEXT_TO_VIDEO",
        status: "QUEUED",
        prompt: body.brief,
        durationSec,
      },
    });
    generationId = generation.id;

    const result = await renderProducerPackage({
      brief: body.brief,
      voiceScript: body.voiceScript,
      aspect: body.aspect,
      narration: body.narration,
      visualDna: (body.visualDna as VisualDna | null) || null,
      durationSec: body.durationSec,
      bgmMode: body.bgmMode,
      bgmTrackId: body.bgmTrackId,
      jobId: generation.id,
      beforePaidProvider: async () => {
        const charge = await atomicChargeCoins({
          userId: user.id,
          kind: "text_to_movie",
          durationSec,
          generationId: generation.id,
          reason: "producer:render:provider",
        });
        if (!charge.ok) {
          throw new Error(charge.message || "Insufficient balance");
        }
        chargedUserId = user.id;
        chargedAmount = charge.cost;
        chargedBalanceAfter = charge.balanceAfter;
      },
    });

    if (!result.ok) {
      if (chargedUserId && chargedAmount > 0) {
        await atomicRollbackCoins({
          userId: user.id,
          amount: chargedAmount,
          generationId: generation.id,
          reason: "rollback:producer_render_failed",
        });
      }
      await prisma.generation.update({
        where: { id: generation.id },
        data: { status: "FAILED", errorMessage: result.error || "Produce failed" },
      });
      return apiError(
        sanitizeGenerationError(result.error || "Produce failed"),
        { status: 500, code: "PRODUCE_FAILED" }
      );
    }

    const dna = (body.visualDna as VisualDna | null) || null;
    const stored = await persistRemoteAsset({
      sourceUrl: result.finalPath!,
      userId: user.id,
      generationId: generation.id,
      kind: "video",
    });
    await prisma.generation.update({
      where: { id: generation.id },
      data: {
        status: "COMPLETED",
        resultUrl: stored.url,
        r2Key: stored.key,
        style: dna?.artStyle || undefined,
        enhancedPrompt: result.promptUsed || undefined,
      },
    });

    await recordInterestFromGeneration({
      userId: user.id,
      prompt: body.brief,
      style: dna?.artStyle || null,
      artStyle: dna?.artStyle || null,
      durationSec,
      aspect:
        body.aspect ||
        (dna?.aspectHint && dna.aspectHint !== "unknown"
          ? dna.aspectHint
          : null),
    });

    return apiJson({
      success: true,
      ok: true,
      jobId: result.jobId,
      videoUrl: stored.url,
      foleyCount: result.foleyCount,
      bgmMood: result.bgmMood,
      bgmTrackId: result.bgmTrackId,
      engine: ALNABIY_ENGINES.gateway,
      audioEngine: ALNABIY_ENGINES.voice,
      promptUsed: result.promptUsed,
      creditsCost: chargedAmount,
      balanceAfter: chargedBalanceAfter,
      message:
        "Final cut ready — picture, voice, sound design, and ambient score in one file.",
    });
  } catch (e: unknown) {
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
    if (
      e instanceof FfmpegCapabilityError ||
      e instanceof ObjectStorageConfigurationError
    ) {
      return apiError(e.message, { status: 503, code: "MEDIA_UNAVAILABLE" });
    }
    const formatted = formatRouteError(e);
    return apiError(sanitizeGenerationError(e, formatted.message), {
      status: formatted.status || 500,
      code: formatted.code,
    });
  }
}
