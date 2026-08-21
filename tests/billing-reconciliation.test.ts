import { afterEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  purchase: { findMany: vi.fn() },
  billingSubscription: { findMany: vi.fn() },
  entitlement: { findMany: vi.fn() },
  billingWebhookEvent: { findMany: vi.fn() },
  billingReconciliation: { upsert: vi.fn() },
  coinLedger: { create: vi.fn() },
  user: { update: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { reconcileBillingRecords } from "@/lib/billing/reconcile";

afterEach(() => {
  vi.clearAllMocks();
});

describe("billing reconciliation", () => {
  it("records a paid-purchase mismatch without silently crediting or changing balances", async () => {
    prismaMock.purchase.findMany.mockResolvedValue([
      { id: "purchase-1", userId: "user-1", ledgerEntries: [] },
    ]);
    prismaMock.billingSubscription.findMany.mockResolvedValue([]);
    prismaMock.entitlement.findMany.mockResolvedValue([]);
    prismaMock.billingWebhookEvent.findMany.mockResolvedValue([]);
    prismaMock.billingReconciliation.upsert.mockResolvedValue({});

    await expect(reconcileBillingRecords()).resolves.toMatchObject({
      findings: 1,
      checkedPurchases: 1,
    });

    expect(prismaMock.billingReconciliation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          kind: "PAID_PURCHASE_MISSING_LEDGER",
          status: "OPEN",
        }),
      })
    );
    expect(prismaMock.coinLedger.create).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
