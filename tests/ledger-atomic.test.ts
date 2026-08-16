import { afterEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  user: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import {
  assertSufficientCoins,
  atomicChargeCoins,
} from "@/lib/ledger/atomic";

afterEach(() => {
  vi.clearAllMocks();
});

describe("ledger charging", () => {
  it("does not approve a generation when the balance is insufficient", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      coins: 19,
      status: "ACTIVE",
    });

    await expect(
      assertSufficientCoins({
        userId: "user-1",
        kind: "prompt_to_video",
        durationSec: 8,
      })
    ).resolves.toMatchObject({
      ok: false,
      code: "INSUFFICIENT",
      cost: 20,
      balanceAfter: 19,
    });
  });

  it("does not write a ledger entry when an atomic debit loses the balance race", async () => {
    const tx = {
      coinLedger: { create: vi.fn() },
      generation: { update: vi.fn() },
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "user-1",
          coins: 20,
          status: "ACTIVE",
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));

    await expect(
      atomicChargeCoins({
        userId: "user-1",
        kind: "prompt_to_video",
        durationSec: 8,
        generationId: "generation-1",
      })
    ).resolves.toMatchObject({
      ok: false,
      code: "INSUFFICIENT",
      cost: 20,
    });

    expect(tx.coinLedger.create).not.toHaveBeenCalled();
    expect(tx.generation.update).not.toHaveBeenCalled();
  });
});
