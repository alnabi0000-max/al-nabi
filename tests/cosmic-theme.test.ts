import { describe, expect, it } from "vitest";
import {
  COSMIC_THEME_IDS,
  DEFAULT_COSMIC_THEME,
  isCosmicThemeId,
  nextCosmicTheme,
} from "@/lib/theme/cosmic";

describe("cosmic background themes", () => {
  it("exposes ten sequential themes", () => {
    expect(COSMIC_THEME_IDS).toHaveLength(10);
    expect(DEFAULT_COSMIC_THEME).toBe("pandora");
  });

  it("cycles the last theme back to the first", () => {
    const last = COSMIC_THEME_IDS[COSMIC_THEME_IDS.length - 1]!;
    expect(nextCosmicTheme(last)).toBe(COSMIC_THEME_IDS[0]);
    expect(nextCosmicTheme("pandora")).toBe("nebula");
  });

  it("rejects unknown theme ids", () => {
    expect(isCosmicThemeId("pandora")).toBe(true);
    expect(isCosmicThemeId("monoxrom")).toBe(false);
    expect(isCosmicThemeId(null)).toBe(false);
  });
});
