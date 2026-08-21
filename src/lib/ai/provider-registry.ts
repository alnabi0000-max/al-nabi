/**
 * Capability-accurate provider registry.
 *
 * This registry deliberately separates a product engine id from the API
 * provider that can execute it. A named provider is never selected merely
 * because an engine label resembles its product name.
 */

import type { CameraMovement } from "@/lib/types";
import {
  calculateGenerationCost,
  chargeableDurationSec,
  type GenerationKind,
} from "@/lib/credits";
import type {
  FrameRate,
  RenderQuality,
  VideoEngineId,
} from "@/lib/ai/catalog";
import {
  generateReplicateVideo,
  getReplicateVideoModel,
  isReplicateConfigured,
} from "@/lib/replicate";

export type ProviderId = "replicate" | "luma" | "runway" | "seedance";
export type VideoInputMode = "text" | "first-frame" | "last-frame" | "source-video";

export type CinematicControlSupport = {
  videoToVideo: boolean;
  continuation: boolean;
  cameraMotion: boolean;
  seed: boolean;
  audioMix: boolean;
};

export type CinematicControls = {
  videoToVideo?: boolean;
  continuation?: boolean;
  seed?: number | null;
  /** Explicit post-/native mix request, not the legacy optional BGM hint. */
  audioMix?: {
    masterMuted?: boolean;
    masterVolume?: number;
    musicVolume?: number;
    voiceVolume?: number;
  } | null;
};

export type ProviderAvailability = {
  provider: ProviderId;
  configured: boolean;
  commercialRoute: "replicate" | "direct";
  reason?: string;
};

export type VideoProviderCapability = {
  engineId: VideoEngineId;
  provider: ProviderId;
  /** Actual execution route, not a product marketing label. */
  commercialRoute: "replicate" | "direct";
  endpointModel: string | null;
  supportedInputs: VideoInputMode[];
  supportedAspects: Array<"16:9" | "9:16" | "1:1">;
  supportedQualities: Array<"720p" | "1080p" | "4K">;
  cinematicControls: CinematicControlSupport;
  maxDurationSec: (quality: RenderQuality | string | undefined) => number;
  nativeAudio: boolean;
  latencySeconds: { p50: number; p90: number };
};

export type VideoRoutingInput = {
  engine?: VideoEngineId | string;
  imageUrl?: string;
  endImageUrl?: string;
  durationSec?: number;
  aspect?: "16:9" | "9:16" | "1:1";
  quality?: RenderQuality | string;
  frameRate?: FrameRate | number;
  cameraMove?: CameraMovement;
  sourceVideoId?: string;
  cinematicControls?: CinematicControls;
};

export type VideoGenerationEstimate = {
  engineId: VideoEngineId;
  provider: ProviderId;
  configured: boolean;
  endpointModel: string | null;
  commercialRoute: "replicate" | "direct";
  effectiveDurationSec: number;
  durationAdjusted: boolean;
  estimatedCredits: number;
  /** Unknown is explicit rather than inventing an upstream commercial price. */
  estimatedProviderCostUsd: null;
  expectedLatencySeconds: { p50: number; p90: number };
  supportedInputs: VideoInputMode[];
  nativeAudio: boolean;
  cinematicControls: CinematicControlSupport;
};

export class ProviderRoutingError extends Error {
  constructor(
    public readonly code:
      | "UNSUPPORTED_ENGINE"
      | "PROVIDER_NOT_CONFIGURED"
      | "PROVIDER_ADAPTER_UNAVAILABLE"
      | "UNSUPPORTED_INPUT"
      | "UNSUPPORTED_ASPECT"
      | "UNSUPPORTED_QUALITY"
      | "UNSUPPORTED_VIDEO_TO_VIDEO"
      | "UNSUPPORTED_CONTINUATION"
      | "UNSUPPORTED_CAMERA_MOTION"
      | "UNSUPPORTED_SEED"
      | "UNSUPPORTED_AUDIO_MIX",
    message: string
  ) {
    super(message);
    this.name = "ProviderRoutingError";
  }
}

const REPLICATE = "replicate" as const;
const ALL_ASPECTS: Array<"16:9" | "9:16" | "1:1"> = [
  "16:9",
  "9:16",
  "1:1",
];
const PROMPT_CINEMATIC_CONTROLS: CinematicControlSupport = {
  videoToVideo: false,
  continuation: false,
  cameraMotion: true,
  seed: false,
  audioMix: false,
};
const NO_CINEMATIC_CONTROLS: CinematicControlSupport = {
  videoToVideo: false,
  continuation: false,
  cameraMotion: false,
  seed: false,
  audioMix: false,
};

function directProviderUnavailable(provider: "luma" | "runway" | "seedance") {
  return {
    provider,
    configured: false,
    commercialRoute: "direct" as const,
    reason: `No ${provider} commercial adapter is configured.`,
  };
}

function replicateAvailability(): ProviderAvailability {
  return isReplicateConfigured()
    ? {
        provider: REPLICATE,
        configured: true,
        commercialRoute: "replicate",
      }
    : {
        provider: REPLICATE,
        configured: false,
        commercialRoute: "replicate",
        reason: "REPLICATE_API_KEY is not configured.",
      };
}

const VIDEO_CAPABILITIES: Record<VideoEngineId, VideoProviderCapability> = {
  auto: {
    engineId: "auto",
    provider: REPLICATE,
    commercialRoute: "replicate",
    get endpointModel() {
      return getReplicateVideoModel("kling-v3");
    },
    supportedInputs: ["text", "first-frame", "last-frame"],
    supportedAspects: ALL_ASPECTS,
    supportedQualities: ["720p", "1080p", "4K"],
    cinematicControls: PROMPT_CINEMATIC_CONTROLS,
    maxDurationSec: () => 15,
    nativeAudio: true,
    latencySeconds: { p50: 90, p90: 300 },
  },
  "kling-v2.5": {
    engineId: "kling-v2.5",
    provider: REPLICATE,
    commercialRoute: "replicate",
    get endpointModel() {
      return getReplicateVideoModel("kling-v2.5");
    },
    supportedInputs: ["text", "first-frame"],
    supportedAspects: ALL_ASPECTS,
    supportedQualities: ["720p", "1080p"],
    cinematicControls: PROMPT_CINEMATIC_CONTROLS,
    maxDurationSec: () => 10,
    nativeAudio: false,
    latencySeconds: { p50: 75, p90: 240 },
  },
  "kling-v3": {
    engineId: "kling-v3",
    provider: REPLICATE,
    commercialRoute: "replicate",
    get endpointModel() {
      return getReplicateVideoModel("kling-v3");
    },
    supportedInputs: ["text", "first-frame", "last-frame"],
    supportedAspects: ALL_ASPECTS,
    supportedQualities: ["720p", "1080p", "4K"],
    cinematicControls: PROMPT_CINEMATIC_CONTROLS,
    maxDurationSec: () => 15,
    nativeAudio: true,
    latencySeconds: { p50: 90, p90: 300 },
  },
  "luma-ray2": {
    engineId: "luma-ray2",
    provider: REPLICATE,
    commercialRoute: "replicate",
    get endpointModel() {
      return getReplicateVideoModel("luma-ray2");
    },
    supportedInputs: ["text", "first-frame"],
    supportedAspects: ALL_ASPECTS,
    supportedQualities: ["720p", "1080p"],
    cinematicControls: PROMPT_CINEMATIC_CONTROLS,
    maxDurationSec: () => 10,
    nativeAudio: false,
    latencySeconds: { p50: 75, p90: 240 },
  },
  /**
   * Kept as an API compatibility id only. It cannot run through a Kling
   * endpoint; a direct Runway adapter must be added before it is usable.
   */
  "runway-gen3": {
    engineId: "runway-gen3",
    provider: "runway",
    commercialRoute: "direct",
    endpointModel: null,
    supportedInputs: ["text", "first-frame"],
    supportedAspects: ALL_ASPECTS,
    supportedQualities: ["720p", "1080p"],
    cinematicControls: NO_CINEMATIC_CONTROLS,
    maxDurationSec: () => 10,
    nativeAudio: false,
    latencySeconds: { p50: 0, p90: 0 },
  },
  "wan-2.5": {
    engineId: "wan-2.5",
    provider: REPLICATE,
    commercialRoute: "replicate",
    get endpointModel() {
      return getReplicateVideoModel("wan-2.5");
    },
    supportedInputs: ["text"],
    supportedAspects: ["16:9", "9:16"],
    supportedQualities: ["720p"],
    cinematicControls: PROMPT_CINEMATIC_CONTROLS,
    maxDurationSec: () => 5,
    nativeAudio: false,
    latencySeconds: { p50: 45, p90: 150 },
  },
  minimax: {
    engineId: "minimax",
    provider: REPLICATE,
    commercialRoute: "replicate",
    get endpointModel() {
      return getReplicateVideoModel("minimax");
    },
    supportedInputs: ["text", "first-frame", "last-frame"],
    supportedAspects: ["16:9"],
    supportedQualities: ["720p", "1080p"],
    cinematicControls: PROMPT_CINEMATIC_CONTROLS,
    maxDurationSec: (quality) => (quality === "720p" ? 10 : 6),
    nativeAudio: false,
    latencySeconds: { p50: 60, p90: 210 },
  },
};

function isVideoEngine(value: string): value is VideoEngineId {
  return Object.prototype.hasOwnProperty.call(VIDEO_CAPABILITIES, value);
}

function normalizedQuality(
  quality?: RenderQuality | string
): "720p" | "1080p" | "4K" {
  return quality === "720p" || quality === "4K" ? quality : "1080p";
}

function availabilityFor(capability: VideoProviderCapability): ProviderAvailability {
  if (capability.provider === REPLICATE) return replicateAvailability();
  return directProviderUnavailable(capability.provider);
}

function assertCompatible(
  capability: VideoProviderCapability,
  input: VideoRoutingInput
): void {
  const inputs: VideoInputMode[] = ["text"];
  if (input.imageUrl) inputs.push("first-frame");
  if (input.endImageUrl) inputs.push("last-frame");
  if (input.sourceVideoId) inputs.push("source-video");

  const unsupported = inputs.find(
    (value) => !capability.supportedInputs.includes(value)
  );
  if (unsupported) {
    throw new ProviderRoutingError(
      "UNSUPPORTED_INPUT",
      `${capability.engineId} does not support ${unsupported} input.`
    );
  }

  const aspect = input.aspect || "16:9";
  if (!capability.supportedAspects.includes(aspect)) {
    throw new ProviderRoutingError(
      "UNSUPPORTED_ASPECT",
      `${capability.engineId} does not support the ${aspect} aspect ratio.`
    );
  }

  const quality = normalizedQuality(input.quality);
  if (!capability.supportedQualities.includes(quality)) {
    throw new ProviderRoutingError(
      "UNSUPPORTED_QUALITY",
      `${capability.engineId} does not support ${quality}.`
    );
  }

  const controls = input.cinematicControls;
  if (input.sourceVideoId || controls?.videoToVideo) {
    if (!capability.cinematicControls.videoToVideo) {
      throw new ProviderRoutingError(
        "UNSUPPORTED_VIDEO_TO_VIDEO",
        `${capability.engineId} does not support video-to-video input on its configured route.`
      );
    }
  }
  if (controls?.continuation) {
    if (!capability.cinematicControls.continuation) {
      throw new ProviderRoutingError(
        "UNSUPPORTED_CONTINUATION",
        `${capability.engineId} does not support continuation on its configured route.`
      );
    }
  }
  if (
    input.cameraMove &&
    input.cameraMove !== "static" &&
    !capability.cinematicControls.cameraMotion
  ) {
    throw new ProviderRoutingError(
      "UNSUPPORTED_CAMERA_MOTION",
      `${capability.engineId} does not support camera/motion controls on its configured route.`
    );
  }
  if (controls?.seed !== undefined && controls.seed !== null) {
    if (!capability.cinematicControls.seed) {
      throw new ProviderRoutingError(
        "UNSUPPORTED_SEED",
        `${capability.engineId} does not support deterministic seed controls on its configured route.`
      );
    }
  }
  if (controls?.audioMix) {
    if (!capability.cinematicControls.audioMix) {
      throw new ProviderRoutingError(
        "UNSUPPORTED_AUDIO_MIX",
        `${capability.engineId} does not support the requested audio mix control on its configured route.`
      );
    }
  }
}

export function getVideoProviderCapability(
  engine?: VideoEngineId | string
): VideoProviderCapability {
  const requested = engine || "auto";
  if (!isVideoEngine(requested)) {
    throw new ProviderRoutingError(
      "UNSUPPORTED_ENGINE",
      `Unknown video engine: ${requested}`
    );
  }
  return VIDEO_CAPABILITIES[requested];
}

export function getVideoGenerationEstimate(
  input: VideoRoutingInput,
  kind: GenerationKind = "prompt_to_video"
): VideoGenerationEstimate {
  const capability = getVideoProviderCapability(input.engine);
  assertCompatible(capability, input);

  const requested = Math.max(1, Math.round(input.durationSec || 15));
  const effectiveDurationSec = Math.min(
    requested,
    capability.maxDurationSec(input.quality)
  );
  const availability = availabilityFor(capability);
  const engineId = capability.engineId;

  return {
    engineId,
    provider: capability.provider,
    configured: availability.configured,
    endpointModel: capability.endpointModel,
    commercialRoute: capability.commercialRoute,
    effectiveDurationSec,
    durationAdjusted: requested !== effectiveDurationSec,
    estimatedCredits: calculateGenerationCost(
      kind,
      chargeableDurationSec(kind, effectiveDurationSec, effectiveDurationSec),
      {
        engine: engineId,
        quality: normalizedQuality(input.quality),
        frameRate: input.frameRate,
        clipMaxSec: effectiveDurationSec,
      }
    ),
    estimatedProviderCostUsd: null,
    expectedLatencySeconds: capability.latencySeconds,
    supportedInputs: availability.configured ? capability.supportedInputs : [],
    nativeAudio: availability.configured ? capability.nativeAudio : false,
    cinematicControls: availability.configured
      ? capability.cinematicControls
      : NO_CINEMATIC_CONTROLS,
  };
}

export async function dispatchVideoWithProvider(
  input: VideoRoutingInput & {
    prompt: string;
    cameraMove?: CameraMovement;
  }
): Promise<{
  url: string;
  provider: string;
  model: string;
  engineId: VideoEngineId;
  estimate: VideoGenerationEstimate;
}> {
  const estimate = getVideoGenerationEstimate(input);
  const capability = getVideoProviderCapability(estimate.engineId);
  const availability = availabilityFor(capability);

  if (!availability.configured) {
    throw new ProviderRoutingError(
      capability.commercialRoute === "direct"
        ? "PROVIDER_ADAPTER_UNAVAILABLE"
        : "PROVIDER_NOT_CONFIGURED",
      availability.reason || `${capability.provider} is unavailable.`
    );
  }

  if (capability.provider !== REPLICATE) {
    throw new ProviderRoutingError(
      "PROVIDER_ADAPTER_UNAVAILABLE",
      `${capability.provider} does not have an enabled commercial adapter.`
    );
  }

  const raw = await generateReplicateVideo({
    prompt: input.prompt,
    imageUrl: input.imageUrl,
    endImageUrl: input.endImageUrl,
    cameraMove: input.cameraMove,
    engine: estimate.engineId,
    durationSec: estimate.effectiveDurationSec,
    aspect: input.aspect,
    quality: normalizedQuality(input.quality),
  });

  return { ...raw, engineId: estimate.engineId, estimate };
}

/**
 * Public capability view for estimates and model-picker disabling. It exposes
 * no credential value and no unconfigured direct provider as executable.
 */
export function listVideoProviderCapabilities() {
  return (Object.keys(VIDEO_CAPABILITIES) as VideoEngineId[]).map((engineId) => {
    const capability = VIDEO_CAPABILITIES[engineId];
    const availability = availabilityFor(capability);
    return {
      engineId,
      provider: capability.provider,
      configured: availability.configured,
      commercialRoute: capability.commercialRoute,
      endpointModel: capability.endpointModel,
      supportedInputs: availability.configured ? capability.supportedInputs : [],
      supportedAspects: availability.configured ? capability.supportedAspects : [],
      supportedQualities: availability.configured ? capability.supportedQualities : [],
      nativeAudio: availability.configured ? capability.nativeAudio : false,
      cinematicControls: availability.configured
        ? capability.cinematicControls
        : NO_CINEMATIC_CONTROLS,
      expectedLatencySeconds: capability.latencySeconds,
      unavailableReason: availability.configured ? null : availability.reason,
    };
  });
}
