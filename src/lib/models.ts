/**
 * 100% White-Label Engine
 * Uchinchi tomon nomlari frontend/API da hech qachon chiqmasin.
 */

export const ALNABIY_ENGINES = {
  realism: "Realism",
  cinema: "Cinematic",
  voice: "Voice",
  director: "Director",
  gateway: "Studio",
} as const;

export type AlnabiyEngineId = keyof typeof ALNABIY_ENGINES;

/** Ichki provider → ommaviy Alnabiy nomi */
const PROVIDER_MAP: Array<{ test: RegExp; engine: AlnabiyEngineId }> = [
  {
    test: /flux|bfl|sd3|sd35|image|still|realism|instant.?id|nano.?banana/i,
    engine: "realism",
  },
  {
    test: /kling|wan|minimax|hailuo|runway|luma|fal|replicate|video|cinema|motion|t2v|i2v|ray-?2|gen3/i,
    engine: "cinema",
  },
  {
    test: /eleven|tts|voice|speech|audio|scribe/i,
    engine: "voice",
  },
  { test: /director|sync|keyframe/i, engine: "director" },
];

export function whiteLabelEngine(raw?: string | null): string {
  if (!raw) return ALNABIY_ENGINES.gateway;
  const s = String(raw);
  for (const { test, engine } of PROVIDER_MAP) {
    if (test.test(s)) return ALNABIY_ENGINES[engine];
  }
  // Noma'lum — hech qachon raw uchinchi tomon nomini qaytarma
  if (/alnabiy/i.test(s)) return s.replace(/[^a-zA-Z0-9 ·.\-]/g, "").slice(0, 64) || ALNABIY_ENGINES.gateway;
  return ALNABIY_ENGINES.gateway;
}

export function whiteLabelModel(raw?: string | null): string {
  if (!raw) return ALNABIY_ENGINES.cinema;
  const s = String(raw).toLowerCase();
  if (/flux|1\.1|image|pro/.test(s)) return ALNABIY_ENGINES.realism;
  if (/wan|2\.5|2\.1|minimax|video|720|1080/.test(s)) return ALNABIY_ENGINES.cinema;
  if (/eleven|multilingual|turbo|v2|v3|tts/.test(s)) return ALNABIY_ENGINES.voice;
  return whiteLabelEngine(raw);
}

/** API javobini white-label qilish */
export function sanitizePublicPayload<T extends Record<string, unknown>>(
  data: T
): T {
  const out = { ...data } as Record<string, unknown>;

  if (typeof out.provider === "string") {
    out.provider = whiteLabelEngine(out.provider);
  }
  if (typeof out.model === "string") {
    out.model = whiteLabelModel(out.model);
  }
  if (out.engines && typeof out.engines === "object" && out.engines !== null) {
    const eng = { ...(out.engines as Record<string, unknown>) };
    if (typeof eng.video === "string") eng.video = whiteLabelModel(eng.video);
    if (typeof eng.audio === "string") eng.audio = ALNABIY_ENGINES.voice;
    if (typeof eng.sync === "string") eng.sync = ALNABIY_ENGINES.director;
    out.engines = eng;
  }
  if (out.audio && typeof out.audio === "object" && out.audio !== null) {
    const audio = { ...(out.audio as Record<string, unknown>) };
    if (typeof audio.model === "string") audio.model = ALNABIY_ENGINES.voice;
    out.audio = audio;
  }
  if (out.director && typeof out.director === "object" && out.director !== null) {
    const dir = { ...(out.director as Record<string, unknown>) };
    if (typeof dir.engine === "string") dir.engine = ALNABIY_ENGINES.cinema;
    out.director = dir;
  }

  return out as T;
}

export function publicEngineCard(): {
  realism: string;
  cinema: string;
  voice: string;
} {
  return {
    realism: ALNABIY_ENGINES.realism,
    cinema: ALNABIY_ENGINES.cinema,
    voice: ALNABIY_ENGINES.voice,
  };
}
