import { afterEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  billingWebhookEvent: {
    create: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { BillingProvider } from "@prisma/client";
import { claimBillingWebhookEvent } from "@/lib/billing/webhook-events";

afterEach(() => {
  vi.clearAllMocks();
});

describe("billing webhook idempotency", () => {
  it("does not reclaim a completed verified provider event", async () => {
    prismaMock.billingWebhookEvent.create.mockRejectedValue(
      Object.assign(new Error("unique"), { code: "P2002" })
    );
    prismaMock.billingWebhookEvent.findUniqueOrThrow.mockResolvedValue({
      id: "event-row-1",
      status: "PROCESSED",
    });

    await expect(
      claimBillingWebhookEvent({
        provider: BillingProvider.STRIPE,
        providerEventId: "evt_123",
        eventType: "checkout.session.completed",
        providerObjectId: "cs_123",
        rawPayload: '{"id":"evt_123"}',
      })
    ).resolves.toEqual({
      claimed: false,
      duplicate: true,
      inProgress: false,
      eventId: "event-row-1",
    });

    expect(prismaMock.billingWebhookEvent.updateMany).not.toHaveBeenCalled();
  });
});
