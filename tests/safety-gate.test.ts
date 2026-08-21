import { afterEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  safetyAudit: { create: vi.fn() },
}));
const moderateText = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/security/moderation", () => ({ moderateText }));

import { evaluateAndAuditSafety } from "@/lib/trust/safety";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("safety gate", () => {
  it("blocks deterministic unsafe text before any external moderation request", async () => {
    const result = await evaluateAndAuditSafety({
      userId: "user-1",
      surface: "generate",
      text: "Create explicit nude imagery",
    });

    expect(result).toMatchObject({
      code: "SAFETY_BLOCKED",
      message: expect.not.stringMatching(/nude|explicit/i),
    });
    expect(moderateText).not.toHaveBeenCalled();
    expect(prismaMock.safetyAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          outcome: "BLOCK",
          inputDigest: expect.not.stringContaining("explicit"),
        }),
      })
    );
  });

  it("holds unassessed reference media for review before a charge can occur", async () => {
    moderateText.mockResolvedValue({
      allowed: true,
      provider: "openrouter",
      categories: [],
    });

    const result = await evaluateAndAuditSafety({
      userId: "user-1",
      surface: "generate",
      text: "A peaceful city at sunset",
      hasReferenceMedia: true,
    });

    expect(result).toMatchObject({
      code: "SAFETY_REVIEW_REQUIRED",
    });
    expect(prismaMock.safetyAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          outcome: "REVIEW",
          referenceMedia: true,
        }),
      })
    );
  });
});
