/**
 * Silent quality gate — baseline negative prompt for every image/video generation.
 * Users never see this. Conflict-aware: intentional styles (grain, blur, titles…)
 * automatically strip the matching negative terms so we don't fight the creative brief.
 *
 * Kling-class guidance: keep the active list focused (~8–14 terms). Overlong
 * negatives flatten motion; priority order matters (earlier = stronger).
 */

export type NegativePromptGroupId =
  | "quality"
  | "blur"
  | "grain_noise"
  | "anatomy"
  | "motion_artifacts"
  | "face_deform"
  | "text_overlay"
  | "watermark"
  | "camera_shake";

type NegGroup = {
  id: NegativePromptGroupId;
  /** Priority-ordered terms within the group (keep 1–2 each) */
  terms: string[];
  /**
   * If ANY pattern matches the creative/user prompt, drop this group's terms.
   * Patterns cover EN / UZ / RU (product locales).
   */
  conflicts?: RegExp[];
};

/**
 * Compact baseline groups — merged active set stays short unless conflicts strip some.
 */
const NEGATIVE_GROUPS: NegGroup[] = [
  {
    id: "quality",
    terms: ["low quality", "jpeg artifacts"],
    conflicts: [
      /\b(lo[\s-]?fi|lofi|low[\s-]?fi|low[\s-]?quality|low[\s-]?res(?:olution)?|lowres|degraded|glitch(?:y|ed)?|datamosh|broken\s*footage|vcr\s*damage|vhs\s*damage)\b/i,
      /\b(past\s*sifat|sifatsiz|buzilgan\s*(video|kadr)|lo[\s-]?fi)\b/i,
      /\b(низк(?:ое|ого|ой)\s*качеств|ло[\s-]?фи|глитч|деград)\b/i,
      /* Intentional aged / grain look must not fight "low quality" negatives */
      /\b(film\s*grain|grainy|old\s*film|vintage\s*film|retro\s*film|super[\s-]?8|16mm|vhs|analog\s*film|aged\s*film)\b/i,
      /\b(don[\s-]?(effekt|li|effekti)?|eski\s*film|vintaj)\b/i,
      /\b(зерн|пл[её]нк|винтаж|старый\s*фильм)\b/i,
    ],
  },
  {
    id: "blur",
    terms: ["blurry", "out of focus"],
    conflicts: [
      /\b(blurry|blurred|out[\s-]?of[\s-]?focus|soft[\s-]?focus|defocus(?:ed)?|dreamy\s*blur|intentional\s*blur|heavy\s*motion\s*blur|rack\s*focus|tilt[\s-]?shift)\b/i,
      /\b(xira|noaniq|yumshoq\s*fokus|blur)\b/i,
      /\b(размыт|нечётк|нечетк|мягк(?:ий|ого)\s*фокус)\b/i,
    ],
  },
  {
    id: "grain_noise",
    terms: ["film grain", "noise"],
    conflicts: [
      /\b(film\s*grain|grainy|grain|vhs|crt|old\s*film|vintage\s*film|retro\s*film|super[\s-]?8|16mm|35mm|analog\s*film|aged\s*film|worn\s*footage|noisy|dust\s*(and|&)\s*scratches|film\s*damage)\b/i,
      /\b(don[\s-]?(effekt|li|effekti)?|eski\s*film|vintaj|parda\s*don|analog\s*film)\b/i,
      /\b(зерн|пл[её]нк|винтаж|старый\s*фильм|vhs|царапин|пыль\s*и\s*царапин)\b/i,
    ],
  },
  {
    id: "anatomy",
    terms: ["bad anatomy", "extra fingers", "deformed hands"],
    conflicts: [
      /\b(extra\s*(arms?|legs?|limbs?|fingers?)|mutant|body\s*horror|surreal\s*anatomy|many\s*arms|multi[\s-]?limb)\b/i,
      /\b(qo['ʻ']shimcha\s*(qo['ʻ']l|oyoq)|tanadagi\s*dahshat)\b/i,
      /\b(лишн(?:ие|их)\s*(рук|ног|палец)|сурреалистичн(?:ая|ой)\s*анатоми)\b/i,
    ],
  },
  {
    id: "motion_artifacts",
    terms: ["morphing", "warping limbs", "unnatural movement"],
    conflicts: [
      /\b(morph(?:ing|s)?|melting|warping|shapeshift|transform(?:ing|ation)\s*(into|between)|glitch\s*morph)\b/i,
      /\b(morph|erib\s*ket|shakl\s*o['ʻ']zgar)\b/i,
      /\b(морф|плавлен|превращен)\b/i,
    ],
  },
  {
    id: "face_deform",
    terms: ["distorted face"],
    conflicts: [
      /\b(distorted\s*face|melted\s*face|cubist|picasso|abstract\s*face|warped\s*face)\b/i,
      /\b(buzilgan\s*yuz|abstrakt\s*yuz)\b/i,
      /\b(искажённ(?:ое|ый)\s*лицо|кубист|абстрактн(?:ое|ый)\s*лицо)\b/i,
    ],
  },
  {
    id: "text_overlay",
    terms: ["text", "subtitle"],
    conflicts: [
      /\b(text\s*on\s*screen|on[\s-]?screen\s*text|title\s*card|subtitle|caption|lower\s*third|typography|letters?\s*on|words?\s*on\s*(the\s*)?screen|sign\s*(that\s*)?says|billboard\s*(with|reading|saying)|credits\s*roll)\b/i,
      /\b(ekranda\s*matn|sarlavha|subtit[rv]|titrl|yozuv\s*ko['ʻ']rsat)\b/i,
      /\b(текст\s*на\s*экране|титры|субтитр|надпись|титульн)\b/i,
    ],
  },
  {
    id: "watermark",
    terms: ["watermark", "logo overlay"],
    conflicts: [
      /\b(watermark\s*(effect|aesthetic|style)|intentional\s*watermark|logo\s*reveal)\b/i,
    ],
  },
  {
    id: "camera_shake",
    terms: ["shaky camera"],
    conflicts: [
      /\b(handheld|shaky(\s*cam(era)?)?|camera\s*shake|verite|cin[eé]ma\s*v[eé]rit[eé]|found\s*footage|docu[\s-]?style)\b/i,
      /\b(qo['ʻ']lda\s*kamera|silkinuvchi\s*kamera)\b/i,
      /\b(ручн(?:ая|ой)\s*камер|тряск(?:ая|ой)\s*камер|found\s*footage)\b/i,
    ],
  },
];

export type BuildNegativePromptResult = {
  negativePrompt: string;
  /** Groups kept in the final string */
  appliedGroups: NegativePromptGroupId[];
  /** Groups dropped because they conflict with the creative prompt */
  strippedGroups: NegativePromptGroupId[];
};

/**
 * Build a conflict-aware negative prompt from the creative/user brief.
 * Pass the user-facing / enhanced creative prompt (not camera-append fluff alone).
 */
export function buildNegativePrompt(
  creativePrompt: string
): BuildNegativePromptResult {
  const source = (creativePrompt || "").trim();
  const appliedGroups: NegativePromptGroupId[] = [];
  const strippedGroups: NegativePromptGroupId[] = [];
  const terms: string[] = [];

  for (const group of NEGATIVE_GROUPS) {
    const conflicts =
      source.length > 0 &&
      Boolean(group.conflicts?.some((re) => re.test(source)));
    if (conflicts) {
      strippedGroups.push(group.id);
      continue;
    }
    appliedGroups.push(group.id);
    terms.push(...group.terms);
  }

  /* Dedupe while preserving first-seen order (priority). */
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const t of terms) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(t);
  }

  return {
    negativePrompt: unique.join(", "),
    appliedGroups,
    strippedGroups,
  };
}

/** Convenience: string only (provider input). */
export function resolveNegativePrompt(creativePrompt: string): string {
  return buildNegativePrompt(creativePrompt).negativePrompt;
}

/** Full baseline with no conflict stripping — useful for docs / audits. */
export function baselineNegativePrompt(): string {
  return buildNegativePrompt("").negativePrompt;
}
