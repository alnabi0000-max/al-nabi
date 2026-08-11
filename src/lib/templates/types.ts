import type { CameraMovement } from "@/lib/types";
import type { VideoEngineId } from "@/lib/ai/catalog";

export type TemplateAspect = "16:9" | "9:16" | "1:1";

export type TemplateCategory = "Cinematic" | "Anime" | "VFX" | "Product";

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  "Cinematic",
  "Anime",
  "VFX",
  "Product",
];

/** Public white-label model ids (never expose third-party names). */
export type AlnabiInternalModel =
  | "alnabi-cinematic"
  | "alnabi-cinematic-ultra"
  | "alnabi-motion-pro"
  | "alnabi-auto";

export type TemplateSystemPreset = {
  aspect_ratio: TemplateAspect;
  motion_level: number;
  internal_model: AlnabiInternalModel | string;
};

export type StudioTemplate = {
  id: number;
  title: string;
  category: TemplateCategory | string;
  preview_video: string;
  /** Style / lighting suffix without the user subject */
  base_prompt: string;
  /** Human-readable structure shown in the drawer, e.g. "{subject}, neon…" */
  prompt_structure: string;
  /** Placeholder for the subject input */
  subject_placeholder: string;
  system_preset: TemplateSystemPreset;
};

export type ResolvedTemplatePreset = {
  aspect: TemplateAspect;
  videoEngine: VideoEngineId;
  cameraMove: CameraMovement;
  basePrompt: string;
  publicModelLabel: string;
};

export type TemplateTransferPayload = {
  templateId: number;
  subject: string;
  prompt: string;
  aspect: TemplateAspect;
  videoEngine: VideoEngineId;
  cameraMove: CameraMovement;
  basePrompt: string;
  title: string;
};

export const TEMPLATE_TRANSFER_KEY = "alnabiy_template_transfer";
