import { NextRequest } from "next/server";
import {
  getVideoGenerationEstimate,
  listVideoProviderCapabilities,
  ProviderRoutingError,
} from "@/lib/ai/provider-registry";
import { apiError, apiJson } from "@/lib/api/json-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Model-picker capability and estimate endpoint. It intentionally returns no
 * credential value or private upstream model identifier.
 */
export async function GET(req: NextRequest) {
  try {
    const engine = req.nextUrl.searchParams.get("engine") || undefined;
    if (!engine) {
      return apiJson({ capabilities: listVideoProviderCapabilities() });
    }

    const duration = Number(req.nextUrl.searchParams.get("durationSec") || 15);
    const videoToVideo = req.nextUrl.searchParams.get("videoToVideo") === "1";
    const continuation = req.nextUrl.searchParams.get("continuation") === "1";
    const seedParam = req.nextUrl.searchParams.get("seed");
    const seed = seedParam === null ? undefined : Number(seedParam);
    const estimate = getVideoGenerationEstimate({
      engine,
      durationSec: Number.isFinite(duration) ? duration : 15,
      aspect:
        (req.nextUrl.searchParams.get("aspect") as
          | "16:9"
          | "9:16"
          | "1:1"
          | null) || "16:9",
      quality: req.nextUrl.searchParams.get("quality") || "1080p",
      imageUrl: req.nextUrl.searchParams.get("image") === "1" ? "requested" : undefined,
      endImageUrl:
        req.nextUrl.searchParams.get("endImage") === "1" ? "requested" : undefined,
      sourceVideoId: videoToVideo || continuation ? "owned-source-requested" : undefined,
      cameraMove:
        (req.nextUrl.searchParams.get("cameraMove") as
          | "static"
          | "zoom_in"
          | "zoom_out"
          | "pan_left"
          | "pan_right"
          | "tilt_up"
          | "tilt_down"
          | "slow_mo"
          | "orbit"
          | null) || undefined,
      cinematicControls:
        videoToVideo || continuation || Number.isFinite(seed)
          ? {
              videoToVideo,
              continuation,
              seed: Number.isFinite(seed) ? seed : undefined,
            }
          : undefined,
    });

    return apiJson({
      estimate: {
        engineId: estimate.engineId,
        configured: estimate.configured,
        commercialRoute: estimate.commercialRoute,
        effectiveDurationSec: estimate.effectiveDurationSec,
        durationAdjusted: estimate.durationAdjusted,
        estimatedCredits: estimate.estimatedCredits,
        estimatedProviderCostUsd: estimate.estimatedProviderCostUsd,
        expectedLatencySeconds: estimate.expectedLatencySeconds,
        supportedInputs: estimate.supportedInputs,
        nativeAudio: estimate.nativeAudio,
        cinematicControls: estimate.cinematicControls,
      },
    });
  } catch (error) {
    if (error instanceof ProviderRoutingError) {
      return apiError(error.message, { status: 422, code: error.code });
    }
    return apiError("Generation capabilities are unavailable.", {
      status: 503,
      code: "CAPABILITIES_UNAVAILABLE",
    });
  }
}
