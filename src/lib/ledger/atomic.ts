import { prisma } from "@/lib/prisma";
import {
  calculateGenerationCost,
  formatInsufficientFundsMessage,
  type CostOpts,
  type GenerationKind,
} from "@/lib/credits";

export type AtomicChargeResult =
  | {
      ok: true;
      cost: number;
      balanceAfter: number;
      userId: string;
      ledgerId: string;
      receiptId: string;
    }
  | {
      ok: false;
      code: "INSUFFICIENT" | "BANNED" | "NOT_FOUND" | "ERROR";
      cost: number;
      /** Current balance when known (not deducted). */
      balanceAfter?: number;
      required?: number;
      message: string;
    };

function receipt(): string {
  return `RCPT-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

/**
 * Read-only preflight: does the user have enough NC?
 * Does NOT debit — use before enqueue so validation failures never charge.
 */
export async function assertSufficientCoins(opts: {
  userId: string;
  kind: GenerationKind;
  durationSec: number;
  costOpts?: CostOpts;
}): Promise<AtomicChargeResult> {
  const cost = calculateGenerationCost(
    opts.kind,
    opts.durationSec,
    opts.costOpts
  );
  try {
    const user = await prisma.user.findUnique({ where: { id: opts.userId } });
    if (!user) {
      return { ok: false, code: "NOT_FOUND", cost, message: "User not found" };
    }
    if (user.status === "BANNED") {
      return {
        ok: false,
        code: "BANNED",
        cost,
        balanceAfter: user.coins,
        message: "Account banned",
      };
    }
    if (user.coins < cost) {
      return {
        ok: false,
        code: "INSUFFICIENT",
        cost,
        required: cost,
        balanceAfter: user.coins,
        message: formatInsufficientFundsMessage(cost, user.coins),
      };
    }
    return {
      ok: true,
      cost,
      balanceAfter: user.coins,
      userId: user.id,
      ledgerId: "",
      receiptId: "",
    };
  } catch (e) {
    return {
      ok: false,
      code: "ERROR",
      cost,
      message: e instanceof Error ? e.message : "Balance check failed",
    };
  }
}

/**
 * Atomic debit: UPDATE … WHERE coins >= cost, then CoinLedger CHARGE.
 * Call this only when the paid AI provider request is about to start
 * (not during validation / enqueue setup).
 */
export async function atomicChargeCoins(opts: {
  userId: string;
  kind: GenerationKind;
  durationSec: number;
  generationId: string;
  reason?: string;
  /** Model / quality pricing */
  costOpts?: CostOpts;
}): Promise<AtomicChargeResult> {
  const cost = calculateGenerationCost(
    opts.kind,
    opts.durationSec,
    opts.costOpts
  );
  const receiptId = receipt();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: opts.userId } });
      if (!user) {
        return {
          ok: false as const,
          code: "NOT_FOUND" as const,
          cost,
          message: "User not found",
        };
      }
      if (user.status === "BANNED") {
        return {
          ok: false as const,
          code: "BANNED" as const,
          cost,
          balanceAfter: user.coins,
          message: "Account banned",
        };
      }

      const updated = await tx.user.updateMany({
        where: {
          id: opts.userId,
          status: "ACTIVE",
          coins: { gte: cost },
        },
        data: { coins: { decrement: cost } },
      });

      if (updated.count === 0) {
        return {
          ok: false as const,
          code: "INSUFFICIENT" as const,
          cost,
          required: cost,
          balanceAfter: user.coins,
          message: formatInsufficientFundsMessage(cost, user.coins),
        };
      }

      const after = await tx.user.findUniqueOrThrow({
        where: { id: opts.userId },
      });

      const ledger = await tx.coinLedger.create({
        data: {
          userId: opts.userId,
          delta: -cost,
          type: "CHARGE",
          reason: opts.reason || `charge:${opts.kind}`,
          generationId: opts.generationId,
          jobId: opts.generationId,
          balanceAfter: after.coins,
          metadata: { receiptId, kind: opts.kind },
        },
      });

      await tx.generation.update({
        where: { id: opts.generationId },
        data: { creditsCost: cost },
      });

      return {
        ok: true as const,
        cost,
        balanceAfter: after.coins,
        userId: opts.userId,
        ledgerId: ledger.id,
        receiptId,
      };
    });

    return result;
  } catch (e) {
    return {
      ok: false,
      code: "ERROR",
      cost,
      message: e instanceof Error ? e.message : "Atomic charge failed",
    };
  }
}

export async function atomicRollbackCoins(opts: {
  userId: string;
  amount: number;
  generationId: string;
  reason?: string;
}): Promise<{
  ok: boolean;
  balanceAfter?: number;
  alreadyRefunded?: boolean;
}> {
  const amount = Math.max(0, opts.amount);
  if (amount <= 0) return { ok: true };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.coinLedger.findFirst({
        where: {
          generationId: opts.generationId,
          type: "ROLLBACK",
        },
        select: { id: true, balanceAfter: true },
      });
      if (existing) {
        return {
          ok: true as const,
          balanceAfter: existing.balanceAfter ?? undefined,
          alreadyRefunded: true as const,
        };
      }

      const updated = await tx.user.update({
        where: { id: opts.userId },
        data: { coins: { increment: amount } },
      });
      await tx.coinLedger.create({
        data: {
          userId: opts.userId,
          delta: amount,
          type: "ROLLBACK",
          reason: opts.reason || "rollback:generation_failed",
          generationId: opts.generationId,
          jobId: opts.generationId,
          balanceAfter: updated.coins,
          metadata: { auto: true },
        },
      });
      return {
        ok: true as const,
        balanceAfter: updated.coins,
        alreadyRefunded: false as const,
      };
    });
    return result;
  } catch (e) {
    console.error(
      "[Al-Nabi] atomicRollbackCoins failed",
      opts.generationId,
      e instanceof Error ? e.message : e
    );
    try {
      const Sentry = await import("@sentry/nextjs");
      Sentry.captureException(e, {
        tags: { area: "ledger-rollback" },
        extra: { generationId: opts.generationId },
      });
    } catch {
      /* soft */
    }
    return { ok: false };
  }
}
