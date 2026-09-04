import { describe, expect, it } from "vitest";
import {
  requiredStudioConsentsGranted,
  STUDIO_REQUIRED_CONSENTS,
} from "@/lib/trust/studio-consent";

describe("studio generation consent", () => {
  it("requires terms, privacy, and AI media processing", () => {
    expect([...STUDIO_REQUIRED_CONSENTS]).toEqual([
      "TERMS",
      "PRIVACY",
      "AI_MEDIA_PROCESSING",
    ]);
  });

  it("is granted only when every required notice is accepted", () => {
    expect(
      requiredStudioConsentsGranted([
        { document: "TERMS", granted: true },
        { document: "PRIVACY", granted: true },
      ])
    ).toBe(false);
    expect(
      requiredStudioConsentsGranted([
        { document: "TERMS", granted: true },
        { document: "PRIVACY", granted: true },
        { document: "AI_MEDIA_PROCESSING", granted: true },
      ])
    ).toBe(true);
  });
});
