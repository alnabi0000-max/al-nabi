/**
 * Long-term Producer interest profile — learned from successful renders/generations.
 * Stored in Prisma; injected into chat as silent creative context (not recited aloud).
 */

import { prisma } from "@/lib/prisma";

export type WeightedTag = { tag: string; count: number };

export type InterestObservation = {
  prompt?: string | null;
  style?: string | null;
  durationSec?: number | null;
  aspect?: string | null;
  artStyle?: string | null;
};

type TagRule = { tag: string; re: RegExp };

const TOPIC_RULES: TagRule[] = [
  {
    tag: "nature",
    re: /\b(nature|landscape|forest|mountain|ocean|sea|river|sunset|sunrise|wildlife|tabiat|tog['ʻ']|daryo|o['ʻ']rmon|quyosh\s*botishi|природ|лес|гор[аы]|океан|закат)\b/i,
  },
  {
    tag: "city",
    re: /\b(city|urban|street|skyline|night\s*city|shahar|ko['ʻ']cha|город|улиц|мегаполис)\b/i,
  },
  {
    tag: "product",
    re: /\b(product|unboxing|commercial|ads?|mahsulot|reklama|товар|реклам)\b/i,
  },
  {
    tag: "people",
    re: /\b(portrait|people|crowd|family|odam|inson|portret|человек|портрет|семь)\b/i,
  },
  {
    tag: "action",
    re: /\b(action|chase|fight|sport|race|harakat|jang|спорт|погоня|экшен)\b/i,
  },
  {
    tag: "fantasy",
    re: /\b(fantasy|magic|dragon|myth|fantastika|sehr|фэнтези|маги)\b/i,
  },
  {
    tag: "tech",
    re: /\b(tech|futur|sci[\s-]?fi|robot|cyber|texnolog|ilmiy\s*fantastika|техно|кибер|робот)\b/i,
  },
];

const STYLE_RULES: TagRule[] = [
  {
    tag: "cinematic",
    re: /\b(cinematic|kinemat\w*|film\s*look|imax|noir|кинемат\w*)\b/i,
  },
  { tag: "anime", re: /\b(anime|manga|аниме)\b/i },
  { tag: "gta", re: /\b(gta|grand\s*theft|rockstar)\b/i },
  { tag: "voxel", re: /\b(voxel|vox[\s-]?style|minecraft)\b/i },
  { tag: "stickman", re: /\b(stick\s*man|stickman)\b/i },
  {
    tag: "photoreal",
    re: /\b(photoreal|hyperreal|realistic|fotoreal|фотореал)\b/i,
  },
  { tag: "cartoon", re: /\b(cartoon|toon|мультик|мультипликац)\b/i },
];

function asTags(value: unknown): WeightedTag[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      const o = v as { tag?: unknown; count?: unknown };
      const tag = typeof o.tag === "string" ? o.tag.trim().toLowerCase() : "";
      const count = typeof o.count === "number" && o.count > 0 ? o.count : 0;
      return tag && count ? { tag, count } : null;
    })
    .filter((x): x is WeightedTag => Boolean(x));
}

function bumpTags(prev: WeightedTag[], incoming: string[], cap = 16): WeightedTag[] {
  const map = new Map<string, number>();
  for (const t of prev) map.set(t.tag, t.count);
  for (const tag of incoming) {
    const key = tag.toLowerCase();
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, cap);
}

function matchTags(text: string, rules: TagRule[]): string[] {
  const hits: string[] = [];
  for (const rule of rules) {
    if (rule.re.test(text)) hits.push(rule.tag);
  }
  return hits;
}

export function durationBucketFromSec(
  sec: number | null | undefined
): "short" | "medium" | "long" | null {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return null;
  if (sec <= 10) return "short";
  if (sec <= 30) return "medium";
  return "long";
}

/** Pure extractor — used by upsert and tests. */
export function extractInterestObservation(
  obs: InterestObservation
): {
  topics: string[];
  styles: string[];
  durationBucket: "short" | "medium" | "long" | null;
  aspect: string | null;
} {
  const blob = [obs.prompt, obs.style, obs.artStyle]
    .filter(Boolean)
    .join("\n");
  const topics = matchTags(blob, TOPIC_RULES);
  const styles = [
    ...matchTags(blob, STYLE_RULES),
    ...(obs.style ? matchTags(obs.style, STYLE_RULES) : []),
    ...(obs.artStyle ? matchTags(obs.artStyle, STYLE_RULES) : []),
  ];
  const uniqueStyles = [...new Set(styles)];
  const aspect =
    obs.aspect === "16:9" || obs.aspect === "9:16" || obs.aspect === "1:1"
      ? obs.aspect
      : null;
  return {
    topics,
    styles: uniqueStyles,
    durationBucket: durationBucketFromSec(obs.durationSec),
    aspect,
  };
}

/**
 * Learn from a completed generation/render. Failures are swallowed — never block produce.
 */
export async function recordInterestFromGeneration(opts: {
  userId: string;
  prompt?: string | null;
  style?: string | null;
  durationSec?: number | null;
  aspect?: string | null;
  artStyle?: string | null;
}): Promise<void> {
  try {
    const extracted = extractInterestObservation(opts);
    if (
      !extracted.topics.length &&
      !extracted.styles.length &&
      !extracted.durationBucket &&
      !extracted.aspect
    ) {
      return;
    }

    const existing = await prisma.producerInterestProfile.findUnique({
      where: { userId: opts.userId },
    });

    const interestTags = bumpTags(
      asTags(existing?.interestTags),
      extracted.topics
    );
    const styleTags = bumpTags(asTags(existing?.styleTags), extracted.styles);
    const sampleCount = (existing?.sampleCount || 0) + 1;

    await prisma.producerInterestProfile.upsert({
      where: { userId: opts.userId },
      create: {
        userId: opts.userId,
        interestTags,
        styleTags,
        durationBucket: extracted.durationBucket,
        preferredAspect: extracted.aspect,
        sampleCount: 1,
      },
      update: {
        interestTags,
        styleTags,
        durationBucket: extracted.durationBucket || existing?.durationBucket,
        preferredAspect: extracted.aspect || existing?.preferredAspect,
        sampleCount,
      },
    });
  } catch (e) {
    console.warn(
      "[Al-Nabi] interest profile update skipped",
      e instanceof Error ? e.message : e
    );
  }
}

/** Compact lines for system prompt — never recited as “your profile says…”. */
export function formatInterestProfileForPrompt(profile: {
  interestTags: unknown;
  styleTags: unknown;
  durationBucket: string | null;
  preferredAspect: string | null;
  sampleCount: number;
} | null): string | null {
  if (!profile || profile.sampleCount <= 0) return null;
  const topics = asTags(profile.interestTags)
    .slice(0, 4)
    .map((t) => t.tag);
  const styles = asTags(profile.styleTags)
    .slice(0, 3)
    .map((t) => t.tag);
  if (!topics.length && !styles.length && !profile.durationBucket) return null;

  const durationLabel =
    profile.durationBucket === "short"
      ? "short clips (~6–10s)"
      : profile.durationBucket === "medium"
        ? "medium clips (~11–30s)"
        : profile.durationBucket === "long"
          ? "longer clips (30s+)"
          : null;

  return [
    topics.length ? `- Ko‘p uchraydigan mavzular: ${topics.join(", ")}` : null,
    styles.length ? `- Afzal uslublar: ${styles.join(", ")}` : null,
    durationLabel ? `- Odatiy davomiylik: ${durationLabel}` : null,
    profile.preferredAspect
      ? `- Odatiy aspekt: ${profile.preferredAspect}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function loadInterestProfilePromptBlock(
  userId: string
): Promise<string | null> {
  try {
    const profile = await prisma.producerInterestProfile.findUnique({
      where: { userId },
    });
    return formatInterestProfileForPrompt(profile);
  } catch {
    return null;
  }
}
