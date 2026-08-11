/**
 * Multilingual intent helpers — Uzbek (Latin/Cyrillic), Russian, English.
 * Typo-tolerant: prefer UI/session locale unless the user clearly switches language.
 */

export type PromptLang = "uz-Latn" | "uz-Cyrl" | "ru" | "en";

const CYRILLIC_RE = /[\u0400-\u04FF]/;
const UZ_SPECIAL_CYRL = /[ўқғҳЎҚҒҲ]/;
const UZ_SPECIAL_LATN = /[oO][ʻ''']|[gG][ʻ''']/;

/** Expanded Uzbek Latin lexicon (incl. common misspellings / missing diacritics). */
const UZ_LATN_MARKERS =
  /\b(salom|assalomu|alaykum|qalaysiz|yahshimisiz|rahmat|mayli|yo'?q|ha+|nima|qanday|gap|aka|opa|bilan|uchun|qilib|bo'?l(adi|sin)?|sahna|odam|yigit|ko'?cha|shahar|yaxshi|yahshi|kerak|iltimos|men|sen|biz|siz|shu|ana|endi|hozir|kecha|ertaga|yasamoq|yarat(moq|ish)?|qilmoq|yoz(moq|ing)?|ayt(moq|ing)?|tushun(dim|madim)?|mumkin|bo'?ladi|kerakmi|marhamat|zo'?r|yomon|tez|sekin|qisqa|uzoq|rasm|ovoz|syujet|goya|menga|senga|bizga|qanaqa|qayer|nega|nimaga|chunki|lekin|ammo|yoki|ham|faqat|juda|biroz|ozgina|ko'?p|kam)\b/i;

const UZ_LATN_MORPH =
  /(?:moq|yapti|yapsiz|yapsan|aman|asan|amiz|asiz|dik|ding|ganman|ganmisiz|lish|lash|chini|ning)\b/i;

const UZ_CYRL_MARKERS =
  /[ўқғҳЎҚҒҲ]|(?:^|[^А-Яа-яЁёЎўҚқҒғҲҳ])(ва|билан|учун|қилиб|бўл|эди|мен|сен|бу|нима|қандай|салом|рахмат|яхши|керак|илтимос|ярат|қил)(?=$|[^А-Яа-яЁёЎўҚқҒғҲҳ])/i;
const UZ_CYRL_GREET =
  /(?:^|[^А-Яа-яЁёЎўҚқҒғҲҳ])(салом|ассалому|қалай|рахмат|яхши|нима|қандай)(?=$|[^А-Яа-яЁёЎўҚқҒғҲҳ])/i;

/** Russian-only function words (avoid shared "видео"). */
const RU_MARKERS =
  /(?:^|[^А-Яа-яЁё])(и|в|на|с|для|это|как|что|сцена|человек|улица|город|девушка|парень|привет|здравств(?:уй|уйте)?|спасибо|хорошо|пожалуйста|сделай|создай|хочу|мне|тебе|давай|можно|нужно|сегодня|завтра)(?=$|[^А-Яа-яЁё])/i;

/** Strong English markers — exclude shared cinema words like "video". */
const EN_STRONG =
  /\b(the|and|with|from|that|this|please|thanks|thank|hello|hey|what|how|where|when|would|could|should|make|create|produce|generate|scene|street|girl|guy|city)\b/i;
const EN_WEAK = /\b(hi+|ok|okay|yes|no|video|film|reels|youtube|prompt)\b/i;

type LangScore = { lang: PromptLang; score: number };

function scoreLanguages(text: string): LangScore[] {
  const t = text.trim();
  if (!t) return [{ lang: "en", score: 0 }];

  const cyrillicChars = (t.match(/[\u0400-\u04FF]/g) || []).length;
  const latinChars = (t.match(/[A-Za-zʻʼ''']/g) || []).length;
  const cyrillicRatio = cyrillicChars / Math.max(1, t.length);

  let uzLatn = 0;
  let uzCyrl = 0;
  let ru = 0;
  let en = 0;

  if (cyrillicRatio > 0.12) {
    if (UZ_SPECIAL_CYRL.test(t)) uzCyrl += 6;
    if (UZ_CYRL_MARKERS.test(t) || UZ_CYRL_GREET.test(t)) uzCyrl += 5;
    if (RU_MARKERS.test(t)) ru += 5;
    // Cyrillic without clear Russian markers → lean Uzbek
    if (uzCyrl === 0 && ru === 0) uzCyrl += 2;
    if (cyrillicRatio > 0.25 && ru >= uzCyrl) ru += 1;
  } else {
    if (UZ_SPECIAL_LATN.test(t)) uzLatn += 5;
    const uzHits = (t.match(UZ_LATN_MARKERS) || []).length;
    uzLatn += Math.min(8, uzHits * 2);
    if (UZ_LATN_MORPH.test(t)) uzLatn += 3;

    const enStrong = (t.match(EN_STRONG) || []).length;
    const enWeak = (t.match(EN_WEAK) || []).length;
    en += enStrong * 3 + Math.min(2, enWeak);

    // Latin-heavy text with no English structure often Uzbek / typo Uzbek
    if (latinChars > 8 && enStrong === 0 && uzLatn > 0) uzLatn += 2;
    if (
      latinChars > 12 &&
      enStrong === 0 &&
      uzLatn === 0 &&
      !/\b(the|and|is|are|to)\b/i.test(t)
    ) {
      uzLatn += 1;
    }
  }

  const ranked: LangScore[] = [
    { lang: "uz-Latn", score: uzLatn },
    { lang: "uz-Cyrl", score: uzCyrl },
    { lang: "ru", score: ru },
    { lang: "en", score: en },
  ];
  return ranked.sort((a, b) => b.score - a.score);
}

/** Detect primary language + script from raw user prompt. */
export function detectPromptLanguage(text: string): PromptLang {
  const ranked = scoreLanguages(text);
  const top = ranked[0];
  if (!top || top.score <= 0) return "en";
  return top.lang;
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

/** Map UI / cookie locale → sticky chat language. */
export function localeToPromptLang(
  locale?: string | null,
  sampleText?: string
): PromptLang {
  const loc = (locale || "").toLowerCase().trim();
  const cyrl = sampleText ? CYRILLIC_RE.test(sampleText) : false;

  if (
    loc === "uz" ||
    loc.includes("uzbek") ||
    loc.includes("oʻzbek") ||
    loc.includes("o'zbek") ||
    loc.includes("ozbek")
  ) {
    return cyrl ? "uz-Cyrl" : "uz-Latn";
  }
  if (loc === "ru" || loc.includes("russian") || loc.includes("рус")) {
    return "ru";
  }
  if (loc === "en" || loc.includes("english")) {
    return "en";
  }
  // Other UI locales: chat still replies in a supported engine language
  return "en";
}

function sameFamily(a: PromptLang, b: PromptLang): boolean {
  if (a === b) return true;
  const uz = (x: PromptLang) => x === "uz-Latn" || x === "uz-Cyrl";
  return uz(a) && uz(b);
}

/**
 * Prefer UI locale when prompt is too short / ambiguous to classify.
 * Used by prompt enhancer (creative descriptions).
 */
export function resolveEnhanceLanguage(
  prompt: string,
  localeName?: string
): PromptLang {
  const ranked = scoreLanguages(prompt);
  const top = ranked[0];
  const sticky = localeToPromptLang(localeName, prompt);

  if (!top || top.score <= 0) return sticky;
  if (wordish(prompt) < 4) return sticky;
  // Strong detection wins; weak detection keeps sticky UI locale
  if (top.score >= 4) return top.lang;
  return sticky;
}

/**
 * Producer Chat language lock:
 * - Stick to UI locale by default (typos must NOT flip language).
 * - Only switch when the latest message has strong evidence of a deliberate language.
 * - Prefer recent conversation language when current message is weak.
 */
export function resolveChatLanguage(opts: {
  lastUserText: string;
  priorUserTexts?: string[];
  localeCode?: string | null;
  localeName?: string | null;
}): PromptLang {
  const text = (opts.lastUserText || "").trim();
  const sticky = localeToPromptLang(
    opts.localeCode || opts.localeName,
    text
  );

  if (!text) return sticky;

  const ranked = scoreLanguages(text);
  const top = ranked[0]!;
  const second = ranked[1]?.score ?? 0;

  // Clear intentional switch away from sticky UI language
  if (top.score >= 5 && top.score >= second + 2 && !sameFamily(top.lang, sticky)) {
    return top.lang;
  }
  // Same family (uz Latin vs Cyrillic) — honor script when confident
  if (top.score >= 4 && sameFamily(top.lang, sticky)) {
    return top.lang;
  }

  // History sticky: reinforce conversation only when it agrees with UI sticky
  const priors = (opts.priorUserTexts || [])
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(-4);
  if (priors.length > 0 && top.score < 5) {
    const histScores: Record<PromptLang, number> = {
      "uz-Latn": 0,
      "uz-Cyrl": 0,
      ru: 0,
      en: 0,
    };
    for (const p of priors) {
      const r = scoreLanguages(p)[0];
      if (r && r.score > 0) histScores[r.lang] += r.score;
    }
    const histBest = (Object.entries(histScores) as [PromptLang, number][])
      .sort((a, b) => b[1] - a[1])[0];
    if (
      histBest &&
      histBest[1] >= 4 &&
      (histBest[0] === sticky || sameFamily(histBest[0], sticky))
    ) {
      return histBest[0];
    }
  }

  // Ambiguous / typo-heavy while UI is Uzbek/Russian → stay on sticky
  if (
    (sticky === "uz-Latn" || sticky === "uz-Cyrl" || sticky === "ru") &&
    top.lang === "en" &&
    top.score < 6
  ) {
    return sticky;
  }

  if (top.score >= 3 && sameFamily(top.lang, sticky)) return top.lang;
  return sticky;
}

function wordish(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export const MULTILINGUAL_SYSTEM_RULES = `MULTILINGUAL (CRITICAL — Al-Nabi Native Engine):
- Interpret Uzbek Latin, Uzbek Cyrillic, Russian, and English with native orthography.
- NEVER refuse, summarize as "non-English", or degrade Uzbek quality.
- Preserve diacritics and letters: oʻ, gʻ, sh, ch, ʼ (Latin); ў, қ, ғ, ҳ (Cyrillic); Russian ё/й/ъ/ь.
- Keep the user's language & script for the creative description; technical cinema terms may remain English.
- Do not mix scripts randomly. Do not drop characters or use mojibake.
- Typos / missing diacritics do NOT change the language — stay in the locked reply language.`;
