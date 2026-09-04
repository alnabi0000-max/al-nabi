import type { CameraMovement } from "@/lib/types";
import type { VideoEngineId } from "@/lib/ai/catalog";
import type {
  ResolvedTemplatePreset,
  StudioTemplate,
  TemplateAspect,
  TemplateTransferPayload,
} from "@/lib/templates/types";
import { TEMPLATE_TRANSFER_KEY } from "@/lib/templates/types";

const MODEL_MAP: Record<
  string,
  { engine: VideoEngineId; label: string }
> = {
  "alnabi-cinematic": {
    engine: "auto",
    label: "Al-Nabi",
  },
  "alnabi-cinematic-ultra": {
    engine: "auto",
    label: "Al-Nabi",
  },
  "alnabi-motion-pro": {
    engine: "auto",
    label: "Al-Nabi",
  },
  "alnabi-auto": {
    engine: "auto",
    label: "Al-Nabi",
  },
};

function cameraFromMotion(level: number): CameraMovement {
  const n = Math.max(0, Math.min(5, Math.round(level)));
  const map: CameraMovement[] = [
    "static",
    "pan_left",
    "zoom_in",
    "tilt_up",
    "orbit",
    "slow_mo",
  ];
  return map[n] ?? "zoom_in";
}

function normalizeAspect(raw: string): TemplateAspect {
  if (raw === "9:16" || raw === "1:1" || raw === "16:9") return raw;
  return "16:9";
}

/** Template → Studio controls (engine ids stay internal). */
export function resolveTemplatePreset(
  template: StudioTemplate
): ResolvedTemplatePreset {
  const preset = template.system_preset;
  const mapped =
    MODEL_MAP[preset.internal_model] || MODEL_MAP["alnabi-cinematic"];

  return {
    aspect: normalizeAspect(preset.aspect_ratio),
    videoEngine: mapped.engine,
    cameraMove: cameraFromMotion(preset.motion_level ?? 3),
    basePrompt: template.base_prompt.trim(),
    publicModelLabel: mapped.label,
  };
}

/** Fill `{subject}` in prompt_structure, or prefix subject + base. */
export function fillTemplatePrompt(
  template: StudioTemplate,
  subject: string
): string {
  const sub = subject.trim() || template.subject_placeholder || "subject";
  const structure =
    template.prompt_structure?.trim() || `{subject}, ${template.base_prompt}`;
  if (structure.includes("{subject}")) {
    return structure.replaceAll("{subject}", sub);
  }
  return composeTemplatePrompt(sub, template.base_prompt);
}

/** User prompt + template base (dedupe if already included). */
export function composeTemplatePrompt(
  userPrompt: string,
  basePrompt: string
): string {
  const user = userPrompt.trim();
  const base = basePrompt.trim();
  if (!base) return user;
  if (!user) return base;
  if (user.toLowerCase().includes(base.toLowerCase())) return user;
  return `${user}, ${base}`;
}

export function buildTransferPayload(
  template: StudioTemplate,
  subject: string
): TemplateTransferPayload {
  const resolved = resolveTemplatePreset(template);
  const prompt = fillTemplatePrompt(template, subject);
  return {
    templateId: template.id,
    subject: subject.trim(),
    prompt,
    aspect: resolved.aspect,
    videoEngine: resolved.videoEngine,
    cameraMove: resolved.cameraMove,
    basePrompt: resolved.basePrompt,
    title: template.title,
  };
}

export function saveTemplateTransfer(payload: TemplateTransferPayload): void {
  try {
    sessionStorage.setItem(TEMPLATE_TRANSFER_KEY, JSON.stringify(payload));
  } catch {
    /* soft */
  }
}

export function consumeTemplateTransfer(): TemplateTransferPayload | null {
  try {
    const raw = sessionStorage.getItem(TEMPLATE_TRANSFER_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(TEMPLATE_TRANSFER_KEY);
    return JSON.parse(raw) as TemplateTransferPayload;
  } catch {
    return null;
  }
}
