/**
 * Billing formula sanity checks (run: npx tsx scripts/verify-billing-formula.ts)
 */
import {
  calculateGenerationCost,
  chargeableDurationSec,
  formatInsufficientFundsMessage,
  billableMinutes,
  CREDIT_RATES,
  PROMPT_TO_VIDEO_CLIP_SEC,
} from "../src/lib/credits";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("OK:", msg);
}

assert(billableMinutes(600) === 10, "600s => 10 billable minutes");
assert(
  calculateGenerationCost("text_to_movie", 600) ===
    10 * CREDIT_RATES.text_to_movie_per_min,
  "10min movie = 400 NC"
);
assert(
  calculateGenerationCost("text_to_movie", 60) ===
    CREDIT_RATES.text_to_movie_per_min,
  "1min movie = 40 NC"
);
assert(
  calculateGenerationCost("text_to_movie", 600) ===
    10 * calculateGenerationCost("text_to_movie", 60),
  "10min is exactly 10x 1min"
);

assert(PROMPT_TO_VIDEO_CLIP_SEC === 8, "clip ceiling 8");
assert(
  chargeableDurationSec("prompt_to_video", 600) === 8,
  "P2V 600s capped to 8"
);
assert(
  calculateGenerationCost("prompt_to_video", 600) ===
    calculateGenerationCost("prompt_to_video", 8),
  "P2V 600s same cost as 8s"
);
assert(
  calculateGenerationCost("prompt_to_video", 10) ===
    calculateGenerationCost("prompt_to_video", 8),
  "P2V UI 10s matches billed 8s"
);

const base = calculateGenerationCost("prompt_to_video", 8);
const kling = calculateGenerationCost("prompt_to_video", 8, {
  engine: "kling-v3",
});
assert(
  kling === Math.max(1, Math.round(base * 1.55)),
  "kling-v3 multiplier"
);

const msg = formatInsufficientFundsMessage(30, 5);
assert(
  msg.includes("30") && msg.includes("5") && msg.includes("NC"),
  "insufficient message"
);

assert(
  calculateGenerationCost("prompt_to_video", 8, { engine: "auto" }) === 30,
  "default P2V 30"
);

console.log("ALL FORMULA CHECKS PASSED");
