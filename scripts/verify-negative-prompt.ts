/**
 * Quick sanity check for conflict-aware negative prompts.
 * Run: npx tsx scripts/verify-negative-prompt.ts
 */
import {
  baselineNegativePrompt,
  buildNegativePrompt,
} from "../src/lib/ai/negative-prompt";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const base = baselineNegativePrompt();
assert(base.includes("low quality"), "baseline should include low quality");
assert(base.includes("watermark"), "baseline should include watermark");
assert(base.includes("blurry"), "baseline should include blurry");
assert(base.includes("extra fingers"), "baseline should include anatomy terms");
assert(
  base.split(", ").length <= 18,
  `baseline too long (${base.split(", ").length} terms)`
);

const vintage = buildNegativePrompt(
  "eski film, don-effektli vintage video, grainy 16mm look"
);
assert(
  vintage.strippedGroups.includes("grain_noise"),
  "vintage should strip grain_noise"
);
assert(
  vintage.strippedGroups.includes("quality"),
  "vintage/eski film should also strip low-quality negatives"
);
assert(
  !vintage.negativePrompt.includes("film grain"),
  "film grain must not appear when user wants grain"
);
assert(
  !vintage.negativePrompt.includes("low quality"),
  "low quality must not appear for eski/don-effekt"
);
assert(
  vintage.negativePrompt.includes("watermark"),
  "watermark should remain for vintage"
);

const blurry = buildNegativePrompt("xira soft focus dreamy portrait");
assert(blurry.strippedGroups.includes("blur"), "xira should strip blur group");
assert(!blurry.negativePrompt.includes("blurry"), "blurry term must be removed");

const titles = buildNegativePrompt(
  "cinematic title card with text on screen reading AL-NABI"
);
assert(
  titles.strippedGroups.includes("text_overlay"),
  "title card should strip text_overlay"
);
assert(
  titles.negativePrompt.includes("watermark"),
  "watermark should remain when only text is intentional"
);

const handheld = buildNegativePrompt("handheld shaky camera vérité documentary");
assert(
  handheld.strippedGroups.includes("camera_shake"),
  "handheld should strip camera_shake"
);

const clean = buildNegativePrompt(
  "epic cinematic drone shot over mountain peaks at golden hour"
);
assert(clean.strippedGroups.length === 0, "clean prompt strips nothing");
assert(
  clean.negativePrompt === base,
  "clean prompt should equal full baseline"
);

console.log("OK — negative prompt conflict detection");
console.log("baseline:", base);
console.log("vintage stripped:", vintage.strippedGroups.join(", "));
console.log("blurry stripped:", blurry.strippedGroups.join(", "));
console.log("titles stripped:", titles.strippedGroups.join(", "));
