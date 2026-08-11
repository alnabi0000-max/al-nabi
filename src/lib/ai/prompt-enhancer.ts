/**
 * Advanced Prompt Auto-Enhancer — OpenRouter only (Claude 3.5 Sonnet).
 * Preserves intentional art styles; smart-bypass for expert prompts;
 * multilingual Uzbek / Russian / English with orthographic fidelity.
 */

import {
  openRouterChat,
  getOpenRouterApiKey,
  getEnhanceModel,
} from "@/lib/ai/openrouter";
import {
  MULTILINGUAL_SYSTEM_RULES,
  languageLabel,
  resolveEnhanceLanguage,
  type PromptLang,
} from "@/lib/ai/prompt-language";
import type { VideoStyle } from "@/lib/types";

export type EnhanceMode =
  | "preserve_style"
  | "smart_bypass"
  | "enrich_simple"
  | "enrich_photoreal";

export type EnhanceResult = {
  enhancedPrompt: string;
  mode: EnhanceMode;
  detectedStyle: string | null;
  language: PromptLang;
  model: string;
  engine: "Al-Nabi Native Engine";
};

/** Explicit non-photoreal / game / illustration styles — never force photoreal */
const ART_STYLE_RE =
  /\b(stick\s*man|stickman|2d\s*pencil|pencil\s*sketch|voxel|vox[\s-]?style|pixel\s*art|pixelated|anime|manga|cartoon|cel[\s-]?shad(?:ed|ing)|comic\s*book|illustration|watercolor|oil\s*paint(?:ing)?|low[\s-]?poly|claymation|stop[\s-]?motion|paper\s*cut|flat\s*design|vector\s*art|line\s*art|noir\s*ink|ukiyo[\s-]?e|chibi|gta(?:\s*(?:style|v|vice\s*city|san\s*andreas))?|grand\s*theft\s*auto|rockstar\s*games?\s*style|toon|hand[\s-]?drawn|sketchy|comic\s*panel|3d\s*render\s*stylized)\b/i;

/** User explicitly wants photoreal — allow photoreal enrichment */
const PHOTOREAL_INTENT_RE =
  /\b(photoreal(?:istic)?|photo[\s-]?real(?:istic)?|hyperreal(?:istic)?|real\s*life|lifelike|live[\s-]?action|documentary\s*realism|8k\s*real)\b/i;

const PHOTOREAL_BAN =
  /\b(photorealistic|photo[\s-]?realistic|8k\s*render|real\s*human\s*skin|subsurface\s*scattering|hyperreal(?:istic)?)\b/i;

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function isComplexPrompt(prompt: string): boolean {
  const w = wordCount(prompt);
  if (w >= 45) return true;
  const technical =
    /\b(fps|aspect\s*ratio|focal\s*length|f\/\d|anamorphic|volumetric|composition|camera\s*(move|path)|lens|shot\s*list|color\s*grade|lut)\b/i.test(
      prompt
    );
  const structured =
    (prompt.match(/[.;]/g)?.length || 0) >= 3 ||
    prompt.includes("\n") ||
    /^(scene|shot|prompt)\s*:/im.test(prompt);
  return technical && (w >= 25 || structured);
}

export function detectArtStyle(
  prompt: string,
  uiStyle?: VideoStyle
): string | null {
  const m = prompt.match(ART_STYLE_RE);
  if (m) {
    const raw = m[0];
    if (/gta|grand\s*theft/i.test(raw)) return "GTA Style";
    if (/stick/i.test(raw)) return "Stickman";
    return raw;
  }
  if (uiStyle === "anime" || uiStyle === "cartoon") return uiStyle;
  return null;
}

export function classifyEnhanceMode(
  prompt: string,
  uiStyle?: VideoStyle
): { mode: EnhanceMode; detectedStyle: string | null } {
  const detectedStyle = detectArtStyle(prompt, uiStyle);
  if (detectedStyle) {
    return { mode: "preserve_style", detectedStyle };
  }
  if (PHOTOREAL_INTENT_RE.test(prompt) || uiStyle === "realistic") {
    return { mode: "enrich_photoreal", detectedStyle: "Photorealistic" };
  }
  if (isComplexPrompt(prompt)) {
    return { mode: "smart_bypass", detectedStyle: null };
  }
  return { mode: "enrich_simple", detectedStyle: null };
}

function systemPromptFor(
  mode: EnhanceMode,
  detectedStyle: string | null,
  lang: PromptLang
): string {
  const langLine = `Output language: ${languageLabel(lang)}. Preserve that script exactly.`;

  if (mode === "preserve_style") {
    return `You are Al-Nabi Native Engine prompt engineer for VIDEO.
${MULTILINGUAL_SYSTEM_RULES}
${langLine}
CRITICAL: The user requested art style "${detectedStyle}". PRESERVE it 100%.
DO NOT add: photorealistic, 8k render, real human skin, subsurface scattering, hyperreal, live-action realism.
ONLY append: camera motion suitable for that style, smooth frame interpolation, lighting consistent with the art style, clean composition.
If style is GTA / Rockstar: keep game-cinematic look (saturated grade, stylized characters) — not documentary realism.
If Stickman / pencil / voxel / anime: keep that medium; never convert to real humans.
Output ONE enhanced prompt paragraph. No preamble. No third-party AI brand names. Max 180 words.`;
  }

  if (mode === "smart_bypass") {
    return `You are Al-Nabi Native Engine technical formatter.
${MULTILINGUAL_SYSTEM_RULES}
${langLine}
The user prompt is already expert/complex. SMART BYPASS:
- Keep the CORE creative text essentially untouched (same subjects, actions, style, language).
- Only normalize/format technical params if missing: FPS 24, aspect if implied, brief camera note.
- Do NOT rewrite into photoreal marketing language.
- Do NOT invent a new scene.
Output ONE prompt paragraph. No preamble. Max 220 words.`;
  }

  if (mode === "enrich_photoreal") {
    return `You are Al-Nabi Native Engine cinematic prompt engineer for VIDEO.
${MULTILINGUAL_SYSTEM_RULES}
${langLine}
The user wants PHOTOREALISTIC / live-action look. Enrich with: physical motion realism, volumetric lighting, optical lens dynamics (subtle DOF / motion blur), skin & material micro-detail, coherent camera move, natural color science.
Keep the original subject and action. No NSFW. No third-party AI brand names.
Output ONE enhanced prompt paragraph. No preamble. Max 200 words.`;
  }

  return `You are Al-Nabi Native Engine cinematic prompt engineer for VIDEO.
${MULTILINGUAL_SYSTEM_RULES}
${langLine}
The user prompt is simple. Enrich with: physical motion realism, volumetric lighting, optical lens dynamics (subtle DOF / motion blur), photorealistic motion descriptors, coherent camera move.
Keep the original subject, action, and language. No NSFW. No third-party AI brand names.
Output ONE enhanced prompt paragraph. No preamble. Max 200 words.`;
}

function localFallback(
  prompt: string,
  mode: EnhanceMode,
  detectedStyle: string | null
): string {
  const base = prompt.trim();
  if (mode === "preserve_style") {
    const style = detectedStyle || "stylized";
    return `${base}. Art style: ${style}, preserve non-photoreal look, smooth motion, coherent camera move, clean framing.`;
  }
  if (mode === "smart_bypass") {
    return base;
  }
  if (mode === "enrich_photoreal") {
    return `${base}. Photorealistic live-action, volumetric light, subtle lens dynamics, natural physics, skin micro-detail, 24fps cinematic feel.`;
  }
  return `${base}. Cinematic motion, volumetric light, subtle lens dynamics, natural physics, photorealistic motion, 24fps feel.`;
}

function stripBannedPhotoreal(text: string, mode: EnhanceMode): string {
  if (mode !== "preserve_style") return text;
  return text
    .replace(PHOTOREAL_BAN, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .trim();
}

/**
 * Intermediate enhance layer — single OpenRouter key, Claude 3.5 Sonnet by default.
 */
export async function enhancePromptWithIntent(opts: {
  prompt: string;
  style?: VideoStyle;
  localeName?: string;
}): Promise<EnhanceResult> {
  const prompt = opts.prompt.trim();
  const { mode, detectedStyle } = classifyEnhanceMode(prompt, opts.style);
  const language = resolveEnhanceLanguage(prompt, opts.localeName);

  if (!getOpenRouterApiKey()) {
    return {
      enhancedPrompt: localFallback(prompt, mode, detectedStyle),
      mode,
      detectedStyle,
      language,
      model: "local-fallback",
      engine: "Al-Nabi Native Engine",
    };
  }

  try {
    const out = await openRouterChat({
      model: getEnhanceModel(),
      temperature:
        mode === "smart_bypass" ? 0.15 : mode === "preserve_style" ? 0.4 : 0.55,
      timeoutMs: 28_000,
      messages: [
        {
          role: "system",
          content: systemPromptFor(mode, detectedStyle, language),
        },
        {
          role: "user",
          content: [
            `UI style hint: ${opts.style || "cinematic"}`,
            `Detected language: ${languageLabel(language)}`,
            `Mode: ${mode}`,
            `Detected art style: ${detectedStyle || "none"}`,
            "",
            "User prompt (preserve intent & orthography):",
            prompt,
          ].join("\n"),
        },
      ],
    });

    if (!out?.trim()) {
      return {
        enhancedPrompt: localFallback(prompt, mode, detectedStyle),
        mode,
        detectedStyle,
        language,
        model: getEnhanceModel(),
        engine: "Al-Nabi Native Engine",
      };
    }

    return {
      enhancedPrompt: stripBannedPhotoreal(out.trim(), mode),
      mode,
      detectedStyle,
      language,
      model: getEnhanceModel(),
      engine: "Al-Nabi Native Engine",
    };
  } catch (e) {
    console.warn(
      "[Al-Nabi] prompt enhancer failed",
      e instanceof Error ? e.message : e
    );
    return {
      enhancedPrompt: localFallback(prompt, mode, detectedStyle),
      mode,
      detectedStyle,
      language,
      model: getEnhanceModel(),
      engine: "Al-Nabi Native Engine",
    };
  }
}
