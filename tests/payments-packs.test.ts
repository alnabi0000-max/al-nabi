import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COIN_PACKS,
  packTotalCoins,
  packVideoCapacity,
  packYield,
} from "@/lib/credits";
import { requiresSessionToken } from "@/lib/auth/protected-routes";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { creditPaidPurchase } from "@/lib/ledger/credit-purchase";

afterEach(() => {
  vi.clearAllMocks();
});

describe("NC package tiers", () => {
  it("credits Starter as 2,100 NC with ~105 standard / ~54 4K videos", () => {
    const starter = COIN_PACKS.find((p) => p.id === "starter");
    expect(starter).toMatchObject({
      priceUsd: 20,
      coins: 2000,
      bonus: 100,
    });
    expect(packTotalCoins(starter!)).toBe(2100);
    expect(packVideoCapacity(2100)).toEqual({
      standardVideos: 105,
      ultra4kVideos: 54,
    });
    expect(packYield(starter!).standardVideos).toBe(105);
    expect(packYield(starter!).ultra4kVideos).toBe(54);
  });

  it("keeps official $20–$100 totals including bonus", () => {
    expect(COIN_PACKS.map((p) => packTotalCoins(p))).toEqual([
      2100, 4400, 6900, 9600, 12500,
    ]);
  });
});

describe("payment routes", () => {
  it("requires a session for checkout and keeps the Stripe webhook public", () => {
    expect(requiresSessionToken("/api/payments/checkout")).toBe(true);
    expect(requiresSessionToken("/api/webhooks/stripe")).toBe(false);
  });
});

describe("idempotent purchase credit", () => {
  it("does not increment the wallet when the Stripe session is already PAID", async () => {
    const tx = {
      purchase: {
        findUnique: vi.fn().mockResolvedValue({
          id: "purchase-1",
          status: "PAID",
        }),
        updateMany: vi.fn(),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({ coins: 2300 }),
        update: vi.fn(),
      },
      coinLedger: { create: vi.fn() },
    };
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback(tx)
    );

    await expect(
      creditPaidPurchase({
        userId: "user-1",
        packId: "starter",
        coins: 2000,
        bonus: 100,
        amountCents: 2000,
        stripeSessionId: "cs_test_1",
      })
    ).resolves.toMatchObject({
      ok: true,
      duplicate: true,
      ncBalance: 2300,
      credited: 2100,
    });

    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.coinLedger.create).not.toHaveBeenCalled();
  });
});
