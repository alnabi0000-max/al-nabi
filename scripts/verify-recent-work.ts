/**
 * Verify recent-work distillation (no DB).
 * Run: npx tsx scripts/verify-recent-work.ts
 */
import { distillRecentWorkLine } from "../src/lib/producer/recent-work";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const line = distillRecentWorkLine({
  prompt: "kinematik tabiat video, tog‘ manzarasi",
  script: null,
  style: "cinematic",
  durationSec: 8,
  type: "TEXT_TO_VIDEO",
  status: "COMPLETED",
  createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
});

assert(line.includes("Oxirgi ish:"), "prefix");
assert(/8s|qisqa/i.test(line), "duration");
assert(/nature|cinematic|kinemat/i.test(line), "topic or style");
assert(line.includes("2 kun oldin") || line.includes("kun oldin"), "relative age");
assert(!line.includes("keling, avval"), "no history dump phrasing");

console.log("OK — recent work distill");
console.log(line);
