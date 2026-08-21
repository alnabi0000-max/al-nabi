import { afterEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  privacyRequest: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findUnique: vi.fn(),
  },
  purchase: { findFirst: vi.fn() },
  generation: { findMany: vi.fn() },
  projectAsset: { findMany: vi.fn() },
  renderVersion: { findMany: vi.fn() },
  projectExport: { findMany: vi.fn() },
  user: { findUniqueOrThrow: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}));
const deleteStoredObject = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/storage/object-storage", () => ({ deleteStoredObject }));

import {
  createErasureRequest,
  PrivacyRequestNotFoundError,
  processErasureRequest,
} from "@/lib/privacy/requests";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("privacy erasure requests", () => {
  it("records a billing-retention hold instead of claiming account erasure", async () => {
    vi.stubEnv("PRIVACY_BILLING_RETENTION_DAYS", "30");
    prismaMock.privacyRequest.findFirst.mockResolvedValue(null);
    prismaMock.purchase.findFirst.mockResolvedValue({ id: "purchase-1" });
    prismaMock.privacyRequest.create.mockResolvedValue({
      id: "request-1",
      type: "ACCOUNT_ERASURE",
      status: "HELD",
      holdReason: "BILLING_RETENTION_HOLD",
      errorCode: null,
      createdAt: new Date("2026-08-20T10:00:00.000Z"),
      confirmationAt: new Date("2026-08-20T10:00:00.000Z"),
      completedAt: null,
    });

    await expect(
      createErasureRequest({
        userId: "user-1",
        confirmation: "ERASE MY ACCOUNT",
      })
    ).resolves.toMatchObject({
      status: "HELD",
      holdReason: "BILLING_RETENTION_HOLD",
    });
    expect(deleteStoredObject).not.toHaveBeenCalled();
  });

  it("does not process an erasure request that is not owned by the caller", async () => {
    prismaMock.privacyRequest.findFirst.mockResolvedValue(null);

    await expect(
      processErasureRequest({ requestId: "request-1", userId: "other-user" })
    ).rejects.toBeInstanceOf(PrivacyRequestNotFoundError);
    expect(deleteStoredObject).not.toHaveBeenCalled();
  });
});
