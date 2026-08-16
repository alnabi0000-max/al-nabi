/**
 * Billing formula + official NC package checks
 * (run: npx tsx scripts/verify-billing-formula.ts)
 */
import {
  calculateGenerationCost,
  chargeableDurationSec,
  formatInsufficientFundsMessage,
  billableMinutes,
  CREDIT_RATES,
  COIN_PACKS,
  PACK_PRICE_IDS,
  PROMPT_TO_VIDEO_CLIP_SEC,
  STANDARD_VIDEO_NC,
  packYield,
} from "../src/lib/credits";
import { buildSilentPricing, getPackPriceUsd } from "../src/lib/geo";

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

assert(STANDARD_VIDEO_NC === 20, "standard video = 20 NC");
assert(
  CREDIT_RATES.prompt_to_video_per_min === STANDARD_VIDEO_NC,
  "P2V rate matches standard video constant"
);
assert(
  calculateGenerationCost("prompt_to_video", 8, { engine: "auto" }) === 20,
  "default P2V 20 NC"
);

const expectedPacks: Array<{
  id: (typeof PACK_PRICE_IDS)[number];
  priceUsd: number;
  coins: number;
  bonus: number;
  bonusPercent: number;
  total: number;
  videos: number;
}> = [
  { id: "starter", priceUsd: 20, coins: 2000, bonus: 100, bonusPercent: 5, total: 2100, videos: 105 },
  { id: "pro", priceUsd: 40, coins: 4000, bonus: 400, bonusPercent: 10, total: 4400, videos: 220 },
  { id: "creator", priceUsd: 60, coins: 6000, bonus: 900, bonusPercent: 15, total: 6900, videos: 345 },
  { id: "business", priceUsd: 80, coins: 8000, bonus: 1600, bonusPercent: 20, total: 9600, videos: 480 },
  { id: "studio", priceUsd: 100, coins: 10000, bonus: 2500, bonusPercent: 25, total: 12500, videos: 625 },
];

assert(COIN_PACKS.length === 5, "exactly 5 official packs");
assert(
  PACK_PRICE_IDS.join(",") === "starter,pro,creator,business,studio",
  "official pack ids"
);

for (const expected of expectedPacks) {
  const pack = COIN_PACKS.find((p) => p.id === expected.id);
  assert(Boolean(pack), `pack ${expected.id} exists`);
  assert(pack!.priceUsd === expected.priceUsd, `${expected.id} price $${expected.priceUsd}`);
  assert(pack!.coins === expected.coins, `${expected.id} base ${expected.coins}`);
  assert(pack!.bonus === expected.bonus, `${expected.id} bonus ${expected.bonus}`);
  assert(
    pack!.bonusPercent === expected.bonusPercent,
    `${expected.id} bonus ${expected.bonusPercent}%`
  );
  const yieldInfo = packYield(pack!);
  assert(yieldInfo.total === expected.total, `${expected.id} total ${expected.total}`);
  assert(
    yieldInfo.videoClips === expected.videos,
    `${expected.id} up to ${expected.videos} videos`
  );
  assert(
    getPackPriceUsd("T1", expected.id) === expected.priceUsd,
    `${expected.id} T1 price is official`
  );
  assert(
    getPackPriceUsd("T2", expected.id) === expected.priceUsd,
    `${expected.id} T2 price is official`
  );
  assert(
    getPackPriceUsd("T3", expected.id) === expected.priceUsd,
    `${expected.id} T3 price is official`
  );
}

const pricing = buildSilentPricing({ country: "US", locale: "en" });
assert(pricing.packs.length === 5, "pricing API returns 5 packs");
assert(
  !pricing.packs.some((p) =>
    ["hollywood", "director", "infinite"].includes(p.id)
  ),
  "legacy pack ids removed from pricing"
);
assert(
  pricing.packs.every((p) => p.videoCapacity === Math.round(p.totalCoins / 20)),
  "pricing video capacity uses 20 NC"
);

const starterCap = packYield(COIN_PACKS[0]!);
assert(starterCap.standardVideos === 105, "Starter ~105 standard videos");
assert(starterCap.ultra4kVideos === 54, "Starter ~54 4K videos");

console.log("ALL FORMULA CHECKS PASSED");
