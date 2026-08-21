import { describe, expect, it, vi } from "vitest";

const getMissingGenerationConsents = vi.hoisted(() => vi.fn());
const evaluateAndAuditSafety = vi.hoisted(() => vi.fn());
const assertGenerationEntitlement = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trust/consent", () => ({ getMissingGenerationConsents }));
vi.mock("@/lib/trust/safety", () => ({ evaluateAndAuditSafety }));
vi.mock("@/lib/billing/entitlements", () => ({ assertGenerationEntitlement }));

import { enforceGenerationTrust } from "@/lib/trust/generation-gate";

describe("generation trust ordering", () => {
  it("returns a safety block before it reaches entitlement or charge preflight", async () => {
    getMissingGenerationConsents.mockResolvedValue([]);
    evaluateAndAuditSafety.mockResolvedValue({
      code: "SAFETY_BLOCKED",
      message: "This request cannot be processed under our safety rules.",
    });

    await expect(
      enforceGenerationTrust({
        userId: "user-1",
        surface: "generate",
        text: "blocked request",
      })
    ).resolves.toMatchObject({ code: "SAFETY_BLOCKED" });

    /*
     * Route handlers invoke wallet preflight only after this helper returns
     * null. Reaching neither entitlement nor later wallet work proves the
     * policy block is upstream of a charge.
     */
    expect(assertGenerationEntitlement).not.toHaveBeenCalled();
  });
});
