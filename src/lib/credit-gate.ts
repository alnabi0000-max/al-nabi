/**
 * Backend credit gate + Rollback
 * DB: User.coins | brauzer: alnabiy_coins
 * 1 rasm=1 · P2V=30/min · Script-Film=40/min
 */

import {
  calculateGenerationCost,
  type CostOpts,
  type GenerationKind,
} from "@/lib/credits";
import { prisma } from "@/lib/prisma";

export interface ChargeRequest {
  kind: GenerationKind;
  durationSec?: number;
  alnabiyKey?: string | null;
  reason?: string;
  jobId?: string;
  /** CoinLedger.generationId (Phase 2+) */
  generationId?: string;
  clientBalance?: number;
  /** Render guard: bonus berilmasin */
  noBonus?: boolean;
  /** Official model / quality pricing */
  costOpts?: CostOpts;
}

export interface ChargeResult {
  ok: boolean;
  code?: "INSUFFICIENT" | "BANNED" | "ERROR" | "UNAVAILABLE";
  cost: number;
  balanceAfter?: number;
  bonusGift?: number;
  receiptId?: string;
  message?: string;
  userId?: string;
}

/** Soft (LS) charge tracking — rollback uchun */
const softCharges = new Map<
  string,
  { cost: number; bonus: number; key: string }
>();

export function computeCost(
  kind: GenerationKind,
  durationSec = 60,
  costOpts?: CostOpts
): number {
  return calculateGenerationCost(kind, durationSec, costOpts);
}

export function computeBonusGift(cost: number): number {
  if (cost <= 0) return 0;
  return Math.min(50, Math.max(1, Math.floor(cost * 0.03)));
}

export async function chargeCredits(
  req: ChargeRequest
): Promise<ChargeResult> {
  const durationSec = req.durationSec ?? 60;
  const cost = computeCost(req.kind, durationSec, req.costOpts);
  const receiptId = `RCPT-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
  const bonusGift = req.noBonus ? 0 : computeBonusGift(cost);

  try {
    if (req.alnabiyKey || process.env.AUTH_MODE === "local") {
      let user = req.alnabiyKey
        ? await prisma.user.findUnique({
            where: { alnabiyKey: req.alnabiyKey },
          })
        : null;
      if (!user) {
        try {
          const { ensureRequestLedgerUser, isSoftAuthEnabled } = await import(
            "@/lib/auth/ensure-request-user"
          );
          if (isSoftAuthEnabled()) {
            const ensured = await ensureRequestLedgerUser({
              alnabiyKey: req.alnabiyKey,
              allowGuest: true,
            });
            if (ensured) {
              user = await prisma.user.findUnique({
                where: { id: ensured.user.id },
              });
            }
          }
        } catch {
          /* soft */
        }
      }
      if (!user) {
        return softCharge(
          req.clientBalance,
          cost,
          bonusGift,
          receiptId,
          req
        );
      }
      if (user.status === "BANNED") {
        return {
          ok: false,
          code: "BANNED",
          cost,
          message: "Account banned",
        };
      }
      const uid = user.id;
      const result = await prisma.$transaction(async (tx) => {
        /* Atomic debit: UPDATE … WHERE coins >= cost avoids TOCTOU double-spend */
        const updated = await tx.user.updateMany({
          where: { id: uid, status: "ACTIVE", coins: { gte: cost } },
          data: { coins: { decrement: cost } },
        });
        if (updated.count === 0) {
          const current = await tx.user.findUnique({ where: { id: uid } });
          return {
            ok: false as const,
            code: "INSUFFICIENT" as const,
            cost,
            balanceAfter: current?.coins,
            message: "Mablag' yetarli emas",
          };
        }
        let afterUser = await tx.user.findUniqueOrThrow({ where: { id: uid } });
        await tx.coinLedger.create({
          data: {
            userId: uid,
            delta: -cost,
            type: "CHARGE",
            reason: req.reason || `charge:${req.kind}`,
            jobId: req.jobId,
            generationId: req.generationId || req.jobId || null,
            balanceAfter: afterUser.coins,
          },
        });
        if (bonusGift > 0) {
          afterUser = await tx.user.update({
            where: { id: uid },
            data: { coins: { increment: bonusGift } },
          });
          await tx.coinLedger.create({
            data: {
              userId: uid,
              delta: bonusGift,
              type: "BONUS",
              reason: "bonus_gift",
              jobId: req.jobId,
              generationId: req.generationId || req.jobId || null,
              balanceAfter: afterUser.coins,
            },
          });
        }
        return {
          ok: true as const,
          cost,
          balanceAfter: afterUser.coins,
          bonusGift,
          receiptId,
          userId: uid,
        };
      });
      return result;
    }
  } catch {
    /* DB yo'q */
  }

  /* Production: never trust clientBalance as a coin faucet */
  const allowSoft =
    process.env.ALLOW_SOFT_CREDITS === "1" ||
    process.env.NODE_ENV !== "production" ||
    process.env.AUTH_MODE === "local";

  if (!allowSoft) {
    return {
      ok: false,
      code: "UNAVAILABLE",
      cost,
      message: "Billing temporarily unavailable",
    };
  }

  return softCharge(req.clientBalance, cost, bonusGift, receiptId, req);
}

/**
 * Generatsiya xatosida tangalarni qaytarish
 */
export async function rollbackCredits(opts: {
  amount: number;
  alnabiyKey?: string | null;
  userId?: string;
  receiptId?: string;
  jobId?: string;
  reason?: string;
  clientBalance?: number;
}): Promise<{ ok: boolean; balanceAfter?: number; rolledBack: number }> {
  const amount = Math.max(0, opts.amount);
  if (amount <= 0) return { ok: true, rolledBack: 0 };

  // Soft ledger
  if (opts.receiptId && softCharges.has(opts.receiptId)) {
    const entry = softCharges.get(opts.receiptId)!;
    softCharges.delete(opts.receiptId);
    const bal =
      typeof opts.clientBalance === "number"
        ? opts.clientBalance + entry.cost - entry.bonus
        : undefined;
    return {
      ok: true,
      balanceAfter: bal,
      rolledBack: entry.cost,
    };
  }

  try {
    let user =
      opts.userId
        ? await prisma.user.findUnique({ where: { id: opts.userId } })
        : null;
    if (!user && opts.alnabiyKey) {
      user = await prisma.user.findUnique({
        where: { alnabiyKey: opts.alnabiyKey },
      });
    }
    if (user) {
      const uid = user.id;
      const balanceAfter = await prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({
          where: { id: uid },
          data: { coins: { increment: amount } },
        });
        await tx.coinLedger.create({
          data: {
            userId: uid,
            delta: amount,
            type: "ROLLBACK",
            reason: opts.reason || "rollback:render_failed",
            jobId: opts.jobId,
            generationId: opts.jobId || null,
            balanceAfter: updated.coins,
          },
        });
        return updated.coins;
      });
      return { ok: true, balanceAfter, rolledBack: amount };
    }
  } catch {
    /* soft */
  }

  const bal =
    typeof opts.clientBalance === "number"
      ? opts.clientBalance + amount
      : undefined;
  return { ok: true, balanceAfter: bal, rolledBack: amount };
}

/**
 * Render oldidan yech → muvaffaqiyatsizlikda rollback
 */
export async function withCreditGuard<T>(opts: {
  kind: GenerationKind;
  durationSec: number;
  alnabiyKey?: string | null;
  clientBalance?: number;
  jobId?: string;
  reason?: string;
  costOpts?: CostOpts;
  run: () => Promise<T>;
}): Promise<
  | { ok: true; data: T; charge: ChargeResult }
  | { ok: false; charge: ChargeResult; error?: string; rolledBack?: number }
> {
  const charge = await chargeCredits({
    kind: opts.kind,
    durationSec: opts.durationSec,
    alnabiyKey: opts.alnabiyKey,
    clientBalance: opts.clientBalance,
    jobId: opts.jobId,
    reason: opts.reason || `render:${opts.kind}`,
    noBonus: true,
    costOpts: opts.costOpts,
  });

  if (!charge.ok) {
    return { ok: false, charge };
  }

  try {
    const data = await opts.run();
    return { ok: true, data, charge };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Render failed";
    const rb = await rollbackCredits({
      amount: charge.cost,
      alnabiyKey: opts.alnabiyKey,
      userId: charge.userId,
      receiptId: charge.receiptId,
      jobId: opts.jobId,
      clientBalance: charge.balanceAfter,
      reason: `rollback:${msg.slice(0, 80)}`,
    });
    return {
      ok: false,
      charge,
      error: msg,
      rolledBack: rb.rolledBack,
    };
  }
}

function softCharge(
  clientBalance: number | undefined,
  cost: number,
  bonusGift: number,
  receiptId: string,
  req: ChargeRequest
): ChargeResult {
  const bal = typeof clientBalance === "number" ? clientBalance : Infinity;
  if (bal < cost) {
    return {
      ok: false,
      code: "INSUFFICIENT",
      cost,
      balanceAfter: bal === Infinity ? undefined : bal,
      message: "Mablag' yetarli emas",
    };
  }
  const balanceAfter =
    bal === Infinity ? undefined : bal - cost + bonusGift;
  softCharges.set(receiptId, {
    cost,
    bonus: bonusGift,
    key: req.alnabiyKey || "anon",
  });
  return {
    ok: true,
    cost,
    balanceAfter,
    bonusGift,
    receiptId,
    message: req.reason,
  };
}
