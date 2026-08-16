import { prisma } from "@/lib/prisma";

/**
 * Atomic NC top-up: mark Purchase PAID (idempotent claim) then increment
 * User.coins (ncBalance) and append a CoinLedger (CreditLedger) row.
 *
 * Concurrent Stripe webhook retries are safe: only the first `updateMany`
 * that observes status != PAID credits the wallet.
 */

export type CreditPurchaseInput = {
  userId: string;
  packId: string;
  coins: number;
  bonus: number;
  amountCents: number;
  stripeSessionId: string;
  stripePaymentIntentId?: string | null;
  regionToken?: string | null;
  purchaseId?: string | null;
  reason?: string;
};

export type CreditPurchaseResult = {
  ok: true;
  duplicate: boolean;
  purchaseId: string;
  ncBalance: number;
  credited: number;
};

export async function creditPaidPurchase(
  input: CreditPurchaseInput
): Promise<CreditPurchaseResult> {
  const credited = input.coins + input.bonus;
  if (credited <= 0) {
    throw new Error("Nothing to credit");
  }
  if (!input.stripeSessionId) {
    throw new Error("stripeSessionId required for idempotency");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.purchase.findUnique({
      where: { stripeSessionId: input.stripeSessionId },
    });
    if (existing?.status === "PAID") {
      const user = await tx.user.findUnique({ where: { id: input.userId } });
      return {
        ok: true as const,
        duplicate: true,
        purchaseId: existing.id,
        ncBalance: user?.coins ?? 0,
        credited,
      };
    }

    let purchaseId = input.purchaseId || existing?.id || null;

    if (!purchaseId) {
      const created = await tx.purchase.upsert({
        where: { stripeSessionId: input.stripeSessionId },
        create: {
          userId: input.userId,
          packId: input.packId,
          coins: input.coins,
          bonus: input.bonus,
          amountCents: input.amountCents,
          currency: "usd",
          status: "PENDING",
          stripeSessionId: input.stripeSessionId,
          stripePaymentIntentId: input.stripePaymentIntentId || null,
          regionToken: input.regionToken || null,
        },
        update: {
          stripePaymentIntentId: input.stripePaymentIntentId || undefined,
        },
      });
      purchaseId = created.id;
    }

    const claim = await tx.purchase.updateMany({
      where: { id: purchaseId, status: { not: "PAID" } },
      data: {
        status: "PAID",
        stripeSessionId: input.stripeSessionId,
        stripePaymentIntentId: input.stripePaymentIntentId || undefined,
        amountCents: input.amountCents,
      },
    });

    if (claim.count === 0) {
      const user = await tx.user.findUnique({ where: { id: input.userId } });
      return {
        ok: true as const,
        duplicate: true,
        purchaseId,
        ncBalance: user?.coins ?? 0,
        credited,
      };
    }

    const updated = await tx.user.update({
      where: { id: input.userId },
      data: { coins: { increment: credited } },
    });

    await tx.coinLedger.create({
      data: {
        userId: input.userId,
        delta: credited,
        type: "PURCHASE",
        reason: input.reason || `stripe:checkout:${input.packId}`,
        purchaseId,
        jobId: input.stripeSessionId,
        balanceAfter: updated.coins,
        metadata: {
          stripeSessionId: input.stripeSessionId,
          packId: input.packId,
          coins: input.coins,
          bonus: input.bonus,
          ncBalance: updated.coins,
        },
      },
    });

    return {
      ok: true as const,
      duplicate: false,
      purchaseId,
      ncBalance: updated.coins,
      credited,
    };
  });
}
