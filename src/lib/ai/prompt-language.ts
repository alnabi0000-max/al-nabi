/**
 * Multilingual intent helpers — Uzbek (Latin/Cyrillic), Russian, English.
 */

export type PromptLang = "uz-Latn" | "uz-Cyrl" | "ru" | "en";

const CYRILLIC_RE = /[\u0400-\u04FF]/;
const UZ_CYRL_MARKERS =
  /[ўқғҳЎҚҒҲ]|[\u0400-\u04FF].*\b(ва|билан|учун|қилиб|бўл|эди|мен|сен|бу)\b/i;
/* Uzbek-specific only — avoid shared EN words (video, ha, men…) false positives */
const UZ_LATN_MARKERS =
  /\b(salom|assalomu|alaykum|qalaysiz|yahshimisiz|rahmat|mayli|yo'?q|nima|qanday|gap|aka|opa|bilan|uchun|qilib|bo'?l|sahna|odam|yigit|ko'?cha|shahar|yaxshi|kerak|iltimos|o['ʻ]g|g['ʻ]h)\b/i;
const UZ_CYRL_GREET =
  /\b(салом|ассалому|қалай|рахмат|яхши|нима|қандай)\b/i;
const RU_MARKERS =
  /\b(и|в|на|с|для|это|как|что|сцена|человек|улица|город|видео|девушка|парень|привет|здравств|спасибо|хорошо)\b/i;
const EN_MARKERS =
  /\b(the|and|with|hello|hi|hey|please|thanks|scene|street|video|produce)\b/i;

/** Detect primary language + script from raw user prompt. */
export function detectPromptLanguage(text: string): PromptLang {
  const t = text.trim();
  if (!t) return "en";

  const cyrillicRatio =
    (t.match(/[\u0400-\u04FF]/g)?.length || 0) / Math.max(1, t.length);

  if (cyrillicRatio > 0.12) {
    if (
      UZ_CYRL_MARKERS.test(t) ||
      UZ_CYRL_GREET.test(t) ||
      /[ўқғҳЎҚҒҲ]/.test(t)
    ) {
      return "uz-Cyrl";
    }
    if (RU_MARKERS.test(t) || cyrillicRatio > 0.2) return "ru";
    return "uz-Cyrl";
  }

  // Prefer English cinema tokens when both could match
  if (EN_MARKERS.test(t) && !UZ_LATN_MARKERS.test(t)) return "en";
  if (UZ_LATN_MARKERS.test(t)) return "uz-Latn";
  if (EN_MARKERS.test(t)) return "en";

  return "en";
}

export function languageLabel(lang: PromptLang): string {
  switch (lang) {
    case "uz-Latn":
      return "Uzbek (Latin script)";
    case "uz-Cyrl":
      return "Uzbek (Cyrillic script)";
    case "ru":
      return "Russian";
    default:
      return "English";
  }
}

/** Prefer UI locale when prompt is too short to classify. */
export function resolveEnhanceLanguage(
  prompt: string,
  localeName?: string
): PromptLang {
  const detected = detectPromptLanguage(prompt);
  if (wordish(prompt) >= 4) return detected;

  const loc = (localeName || "").toLowerCase();
  if (loc.includes("uzbek") || loc === "uz" || loc.includes("oʻzbek")) {
    return CYRILLIC_RE.test(prompt) ? "uz-Cyrl" : "uz-Latn";
  }
  if (loc.includes("russian") || loc === "ru" || loc.includes("рус")) {
    return "ru";
  }
  return detected === "en" ? "en" : detected;
}

function wordish(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export const MULTILINGUAL_SYSTEM_RULES = `MULTILINGUAL (CRITICAL — Al-Nabi Native Engine):
- Interpret Uzbek Latin, Uzbek Cyrillic, Russian, and English with native orthography.
- NEVER refuse, summarize as "non-English", or degrade Uzbek quality.
- Preserve diacritics and letters: oʻ, gʻ, sh, ch, ʼ (Latin); ў, қ, ғ, ҳ (Cyrillic); Russian ё/й/ъ/ь.
- Keep the user's language & script for the creative description; technical cinema terms may remain English.
- Do not mix scripts randomly. Do not drop characters or use mojibake.`;
