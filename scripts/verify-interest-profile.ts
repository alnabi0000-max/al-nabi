/**
 * Verify interest tag extraction + prompt formatting (no DB required).
 * Run: npx tsx scripts/verify-interest-profile.ts
 */
import {
  extractInterestObservation,
  formatInterestProfileForPrompt,
  durationBucketFromSec,
} from "../src/lib/producer/interest-profile";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const nature = extractInterestObservation({
  prompt: "kinematik tabiat video, tog‘ va quyosh botishi, 8 soniya",
  durationSec: 8,
  aspect: "9:16",
});
assert(nature.topics.includes("nature"), "should detect nature/tabiat");
assert(nature.styles.includes("cinematic"), "should detect cinematic/kinematik");
assert(nature.durationBucket === "short", "8s → short");
assert(nature.aspect === "9:16", "aspect preserved");

assert(durationBucketFromSec(25) === "medium", "25s → medium");
assert(durationBucketFromSec(45) === "long", "45s → long");

const block = formatInterestProfileForPrompt({
  interestTags: [
    { tag: "nature", count: 4 },
    { tag: "city", count: 1 },
  ],
  styleTags: [{ tag: "cinematic", count: 3 }],
  durationBucket: "short",
  preferredAspect: "9:16",
  sampleCount: 5,
});
assert(Boolean(block), "format should produce block");
assert(block!.includes("nature"), "topics in block");
assert(block!.includes("cinematic"), "styles in block");
assert(!block!.toLowerCase().includes("profilingiz"), "no meta-speak");

console.log("OK — interest profile extraction");
console.log(block);
