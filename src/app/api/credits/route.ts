import { NextResponse } from "next/server";
import {
  CREDIT_RATES,
  DEMO_STARTING_CREDITS,
  formatCredits,
} from "@/lib/credits";

export async function GET() {
  return NextResponse.json({
    credits: DEMO_STARTING_CREDITS,
    formatted: formatCredits(DEMO_STARTING_CREDITS),
    rates: {
      image: CREDIT_RATES.image,
      prompt_to_video: CREDIT_RATES.prompt_to_video_per_min,
      prompt_to_video_per_min: CREDIT_RATES.prompt_to_video_per_min,
      text_to_movie_per_min: CREDIT_RATES.text_to_movie_per_min,
    },
    rate:
      "1 Image=1 · Video=20 NC (standard) · Movie=40/min NC",
    usdPerCoin: 0.01,
  });
}
