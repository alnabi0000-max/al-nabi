/**
 * Classifier sanity checks (no API key). Mirror of prompt-enhancer / prompt-language rules.
 * Run: node scripts/verify-prompt-brain.mjs
 */
import assert from "assert";

const ART_STYLE_RE =
  /\b(stick\s*man|stickman|voxel|gta(?:\s*(?:style|v))?|anime|cartoon)\b/i;
const PHOTOREAL_INTENT_RE = /\b(photoreal(?:istic)?|photo[\s-]?real)\b/i;

function detectLang(t) {
  if (/[ўқғҳ]/i.test(t) || (/[\u0400-\u04FF]/.test(t) && /\b(ва|билан)\b/i.test(t)))
    return "uz-Cyrl";
  if (/[\u0400-\u04FF]/.test(t)) return "ru";
  if (/\b(va|bilan|uchun|ko'?cha|yigit)\b/i.test(t)) return "uz-Latn";
  return "en";
}

function mode(prompt) {
  if (ART_STYLE_RE.test(prompt)) return "preserve_style";
  if (PHOTOREAL_INTENT_RE.test(prompt)) return "enrich_photoreal";
  if (prompt.split(/\s+/).length >= 45) return "smart_bypass";
  if (/\b(fps|anamorphic|shot\s*list)\b/i.test(prompt) && prompt.length > 80)
    return "smart_bypass";
  return "enrich_simple";
}

assert.equal(detectLang("ko'cha bo'ylab yigit yuradi"), "uz-Latn");
assert.equal(detectLang("улица ночью, девушка идёт"), "ru");
assert.equal(detectLang("a man walks down the street"), "en");
assert.equal(mode("stickman fighting"), "preserve_style");
assert.equal(mode("GTA Style chase"), "preserve_style");
assert.equal(mode("photorealistic sailor"), "enrich_photoreal");
assert.equal(mode("cat runs"), "enrich_simple");
assert.equal(
  mode(
    "Scene: neon. Camera: anamorphic. FPS 24. Shot list: push-in then orbit around subject carefully."
  ),
  "smart_bypass"
);

console.log("prompt-brain OK");
