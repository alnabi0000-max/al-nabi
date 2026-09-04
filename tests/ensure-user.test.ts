import { afterEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  coinLedger: { create: vi.fn(), updateMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { ensurePrismaUser } from "@/lib/auth/ensure-user";

afterEach(() => {
  vi.clearAllMocks();
});

const identity = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "user@example.com",
  name: "Ada",
  authProvider: "GOOGLE" as const,
};

function uniqueError() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "6.19.3",
    meta: { target: ["email"] },
  });
}

describe("ensurePrismaUser", () => {
  it("updates last login when the Supabase id already exists", async () => {
    const existing = {
      id: identity.id,
      email: identity.email,
      name: "Ada",
      authProvider: "GOOGLE",
    };
    prismaMock.user.findUnique.mockResolvedValueOnce(existing);
    prismaMock.user.update.mockResolvedValueOnce({
      ...existing,
      lastLoginAt: new Date(),
    });

    await expect(ensurePrismaUser(identity)).resolves.toMatchObject({
      id: identity.id,
      email: identity.email,
    });
    expect(prismaMock.user.update).toHaveBeenCalledOnce();
  });

  it("creates a ledger user when neither id nor email exists", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const created = { id: identity.id, email: identity.email, coins: 200 };
    prismaMock.$transaction.mockImplementation(async (callback) => {
      const tx = {
        user: { create: vi.fn().mockResolvedValue(created) },
        coinLedger: { create: vi.fn().mockResolvedValue({}) },
      };
      return callback(tx);
    });

    await expect(ensurePrismaUser(identity)).resolves.toMatchObject(created);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it("retries after a unique race and returns the concurrent row", async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: identity.id,
        email: identity.email,
        authProvider: "GOOGLE",
        name: "Ada",
      });
    prismaMock.$transaction.mockRejectedValueOnce(uniqueError());
    prismaMock.user.update.mockResolvedValueOnce({
      id: identity.id,
      email: identity.email,
      authProvider: "GOOGLE",
    });

    await expect(ensurePrismaUser(identity)).resolves.toMatchObject({
      id: identity.id,
    });
  });

  it("adopts an existing email row onto the Google Auth UUID", async () => {
    const prior = {
      id: "22222222-2222-4222-8222-222222222222",
      email: identity.email,
      name: "Ada",
      coins: 80,
      plan: "FREE",
      role: "USER",
      status: "ACTIVE",
      locale: "uz",
      avatarUrl: null,
      referralCode: "ALNABIY-OLD",
      alnabiyKey: "local_old",
      stripeCustomerId: null,
      referredBy: null,
      authProvider: "PASSWORD",
      lastLoginAt: null,
    };
    prismaMock.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(prior)
      .mockResolvedValueOnce(null);

    const created = { ...prior, id: identity.id, authProvider: "GOOGLE" };
    prismaMock.$transaction.mockImplementation(async (callback) => {
      const tx = {
        user: {
          update: vi.fn().mockResolvedValue(prior),
          create: vi.fn().mockResolvedValue(created),
          delete: vi.fn().mockResolvedValue(prior),
        },
        coinLedger: { updateMany: vi.fn() },
        generation: { updateMany: vi.fn() },
        purchase: { updateMany: vi.fn() },
        referral: { updateMany: vi.fn() },
        session: { updateMany: vi.fn() },
        producerInterestProfile: { updateMany: vi.fn() },
        project: { updateMany: vi.fn() },
        projectAsset: { updateMany: vi.fn() },
        projectExport: { updateMany: vi.fn() },
        approval: { updateMany: vi.fn() },
        userConsent: { updateMany: vi.fn() },
        safetyAudit: { updateMany: vi.fn() },
        privacyRequest: { updateMany: vi.fn() },
        billingSubscription: { updateMany: vi.fn() },
        entitlement: { updateMany: vi.fn() },
        billingWebhookEvent: { updateMany: vi.fn() },
        billingReconciliation: { updateMany: vi.fn() },
        adminSettings: { updateMany: vi.fn() },
      };
      return callback(tx);
    });

    await expect(ensurePrismaUser(identity)).resolves.toMatchObject({
      id: identity.id,
      email: identity.email,
    });
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });
});
