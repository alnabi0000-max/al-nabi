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
      coinLedger: { create: vi.fn(), findFirst: vi.fn().mockResolvedValue(null) },
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

  it("returns an existing generation charge without debiting again", async () => {
    const tx = {
      coinLedger: {
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({
          id: "ledger-1",
          delta: -20,
        }),
      },
      generation: { update: vi.fn() },
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "user-1",
          coins: 80,
          status: "ACTIVE",
        }),
        updateMany: vi.fn(),
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
      ok: true,
      cost: 20,
      balanceAfter: 80,
      ledgerId: "ledger-1",
    });

    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.coinLedger.create).not.toHaveBeenCalled();
  });

  it("keeps a retried timeline-export generation to one ledger debit", async () => {
    const tx = {
      coinLedger: {
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({
          id: "export-ledger-1",
          delta: -40,
        }),
      },
      generation: { update: vi.fn() },
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "user-1",
          coins: 60,
          status: "ACTIVE",
        }),
        updateMany: vi.fn(),
      },
    };
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));

    await expect(
      atomicChargeCoins({
        userId: "user-1",
        kind: "text_to_movie",
        durationSec: 60,
        generationId: "timeline-export-generation-1",
        reason: "project:timeline_export",
      })
    ).resolves.toMatchObject({
      ok: true,
      cost: 40,
      ledgerId: "export-ledger-1",
    });

    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.coinLedger.create).not.toHaveBeenCalled();
  });
});
