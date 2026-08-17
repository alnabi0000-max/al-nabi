import {
  cameraLightingSchema,
  formatCameraLightingPrompt,
  type CameraLighting,
} from "@/lib/ai/camera-lighting";

export const PRO_MODE_STORAGE_KEY = "alnabiy_studio_pro_mode";

export type LightingJoystickValue = {
  azimuthDeg: number;
  elevationDeg: number;
  intensity: number;
};

export const DEFAULT_LIGHTING: LightingJoystickValue = {
  azimuthDeg: 38,
  elevationDeg: 26,
  intensity: 1.15,
};

export type StudioKeyframePair = {
  startUrl: string | null;
  endUrl: string | null;
};

export type NegativeCanvasValue = {
  dataUrl: string | null;
  strokeCount: number;
};

export const EMPTY_KEYFRAMES: StudioKeyframePair = {
  startUrl: null,
  endUrl: null,
};

export const EMPTY_NEGATIVE_CANVAS: NegativeCanvasValue = {
  dataUrl: null,
  strokeCount: 0,
};

export const DRAFT_PREVIEW_SEC = 5;

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function readStoredProMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PRO_MODE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeStoredProMode(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PRO_MODE_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* persist is optional */
  }
}

export function joystickToCameraLighting(
  value: LightingJoystickValue
): CameraLighting {
  const azimuth = (value.azimuthDeg * Math.PI) / 180;
  const elevation = (value.elevationDeg * Math.PI) / 180;
  const x = Math.cos(elevation) * Math.sin(azimuth);
  const y = Math.sin(elevation);
  const z = Math.cos(elevation) * Math.cos(azimuth);
  return cameraLightingSchema.parse({
    lights: [
      {
        role: "key",
        position: {
          x: round3(x * 2),
          y: round3(y * 2),
          z: round3(z * 2),
        },
        direction: {
          x: round3(-x),
          y: round3(-y),
          z: round3(-z),
        },
        intensity: value.intensity,
        color: "#fff1d6",
      },
    ],
  });
}

/**
 * Provider-safe prompt merge. Lighting becomes text; keyframe/canvas stay
 * descriptive hints because the current video APIs have no mask/timeline fields.
 */
export function composeProAwarePrompt(opts: {
  prompt: string;
  proMode: boolean;
  lighting: LightingJoystickValue;
  hasEndKeyframe: boolean;
  negativeStrokeCount: number;
}): string {
  const base = opts.prompt.trim();
  if (!opts.proMode || !base) return base;

  let next = formatCameraLightingPrompt({
    prompt: base,
    cameraLighting: joystickToCameraLighting(opts.lighting),
  });

  if (opts.hasEndKeyframe) {
    next = `${next} Closing composition matches the end keyframe.`;
  }
  if (opts.negativeStrokeCount > 0) {
    next = `${next} Keep painted negative-mask regions free of new objects and artifacts.`;
  }
  return next.length > 2000 ? next.slice(0, 2000).trimEnd() : next;
}
