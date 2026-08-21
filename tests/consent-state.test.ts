import { afterEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  userConsent: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import {
  ConsentAction,
  ConsentDocument,
} from "@prisma/client";
import {
  getConsentStatus,
  recordConsentAction,
} from "@/lib/trust/consent";

afterEach(() => {
  vi.clearAllMocks();
});

describe("versioned consent state", () => {
  it("uses the latest action for the current version without rewriting history", async () => {
    const grantedAt = new Date("2026-08-20T10:00:00.000Z");
    const withdrawnAt = new Date("2026-08-20T11:00:00.000Z");
    prismaMock.userConsent.findMany.mockResolvedValue([
      {
        document: ConsentDocument.AI_MEDIA_PROCESSING,
        documentVersion: "2026-08-20",
        action: ConsentAction.WITHDRAWN,
        recordedAt: withdrawnAt,
      },
      {
        document: ConsentDocument.AI_MEDIA_PROCESSING,
        documentVersion: "2026-08-20",
        action: ConsentAction.GRANTED,
        recordedAt: grantedAt,
      },
    ]);

    const status = await getConsentStatus("user-1");
    expect(
      status.find((item) => item.document === ConsentDocument.AI_MEDIA_PROCESSING)
    ).toMatchObject({
      granted: false,
      withdrawable: true,
      recordedAt: withdrawnAt.toISOString(),
    });
  });

  it("records a later withdrawal as a new append-only action", async () => {
    prismaMock.userConsent.findFirst.mockResolvedValue({
      id: "grant-1",
      document: ConsentDocument.AI_MEDIA_PROCESSING,
      documentVersion: "2026-08-20",
      action: ConsentAction.GRANTED,
      recordedAt: new Date("2026-08-20T10:00:00.000Z"),
    });
    prismaMock.userConsent.create.mockResolvedValue({
      id: "withdraw-1",
      document: ConsentDocument.AI_MEDIA_PROCESSING,
      documentVersion: "2026-08-20",
      action: ConsentAction.WITHDRAWN,
      recordedAt: new Date("2026-08-20T11:00:00.000Z"),
    });

    await expect(
      recordConsentAction({
        userId: "user-1",
        document: ConsentDocument.AI_MEDIA_PROCESSING,
        action: ConsentAction.WITHDRAWN,
      })
    ).resolves.toMatchObject({ granted: false });

    expect(prismaMock.userConsent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: ConsentAction.WITHDRAWN,
          documentVersion: "2026-08-20",
        }),
      })
    );
  });
});
