import { prisma } from "@/lib/prisma";
import { atomicRollbackCoins } from "@/lib/ledger/atomic";
import {
  captureGenerationFailure,
  sanitizeGenerationError,
} from "@/lib/generation/public-error";
import {
  releaseProjectReservation,
  settleProjectRefund,
} from "@/lib/projects/spend";

export type FailAndRefundResult = {
  ok: true;
  refunded: boolean;
  balanceAfter?: number;
  errorMessage: string;
};

/**
 * Mark generation FAILED, sanitize error, auto-refund charged coins (idempotent).
 */
export async function failAndRefundGeneration(opts: {
  generationId: string;
  error: unknown;
  errorCode?: string;
  area?: string;
  reason?: string;
}): Promise<FailAndRefundResult> {
  const area = opts.area || "generation";
  const errorMessage = sanitizeGenerationError(opts.error);
  const failureCode = (opts.errorCode || errorMessage).slice(0, 120);

  await captureGenerationFailure(opts.error, {
    generationId: opts.generationId,
    area,
  });

  const generation = await prisma.generation.findUnique({
    where: { id: opts.generationId },
  });

  if (!generation) {
    return { ok: true, refunded: false, errorMessage };
  }

  if (generation.status !== "FAILED") {
    await prisma.generation.update({
      where: { id: opts.generationId },
      data: {
        status: "FAILED",
        errorMessage: errorMessage.slice(0, 500),
      },
    });
  } else if (
    !generation.errorMessage ||
    generation.errorMessage !== errorMessage
  ) {
    await prisma.generation.update({
      where: { id: opts.generationId },
      data: { errorMessage: errorMessage.slice(0, 500) },
    });
  }

  await releaseProjectReservation(opts.generationId);
  await prisma.renderVersion.updateMany({
    where: { generationId: opts.generationId },
    data: { status: "FAILED" },
  });
  await prisma.modelRun.updateMany({
    where: { generationId: opts.generationId },
    data: { status: "FAILED", failureCode },
  });

  let refunded = false;
  let balanceAfter: number | undefined;

  if (generation.creditsCost > 0) {
    const rb = await atomicRollbackCoins({
      userId: generation.userId,
      amount: generation.creditsCost,
      generationId: opts.generationId,
      reason:
        opts.reason ||
        `rollback:auto:${errorMessage.slice(0, 80)}`,
    });
    refunded = rb.ok && !rb.alreadyRefunded;
    balanceAfter = rb.balanceAfter;
    if (rb.ok) {
      await settleProjectRefund(opts.generationId).catch((projectError) => {
        console.error(
          "[Al-Nabi] project refund reconciliation failed",
          opts.generationId,
          projectError
        );
      });
    }
  }

  return { ok: true, refunded, balanceAfter, errorMessage };
}

const STALE_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Reclaim stuck QUEUED / GENERATING_* jobs → FAILED + refund.
 * Safe to call from status polling.
 */
export async function reclaimStaleGeneration(
  generationId: string
): Promise<boolean> {
  const generation = await prisma.generation.findUnique({
    where: { id: generationId },
    select: {
      id: true,
      status: true,
      updatedAt: true,
      createdAt: true,
      creditsCost: true,
    },
  });
  if (!generation) return false;

  const staleStatuses = new Set([
    "QUEUED",
    "ANALYZING",
    "GENERATING_VIDEO",
    "GENERATING_AUDIO",
    "MERGING",
  ]);
  if (!staleStatuses.has(generation.status)) return false;

  const age =
    Date.now() -
    new Date(generation.updatedAt || generation.createdAt).getTime();
  if (age < STALE_MS) return false;

  await failAndRefundGeneration({
    generationId,
    error: "Generation stalled past timeout",
    area: "stale-reclaim",
    reason: "rollback:stale_timeout",
  });
  return true;
}
