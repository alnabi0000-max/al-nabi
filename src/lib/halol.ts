import { AlnabiySentinelEngine } from "@/lib/sentinel-engine";

/** Halol Qalqon — harf darajasida Regex filtr + Sentinel */
const BANNED = [
  "porno",
  "porn",
  "sex",
  "seks",
  "naked",
  "nude",
  "erotik",
  "erotic",
  "erotika",
  "nsfw",
  "xxx",
  "hentai",
  "jinsiy",
  "fuck",
  "anal",
  "bdsm",
  "onlyfans",
  "порно",
  "секс",
  "голый",
  "эротик",
];

export function scanHalol(text: string): { blocked: boolean; word: string | null } {
  if (!text) return { blocked: false, word: null };
  if (AlnabiySentinelEngine.isForbidden(text)) {
    return { blocked: true, word: "sentinel" };
  }
  const lower = text.toLowerCase();
  for (const w of BANNED) {
    const pattern = w
      .split("")
      .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("[\\s\\-_.*]*");
    if (new RegExp(pattern, "i").test(lower)) {
      return { blocked: true, word: w };
    }
  }
  return { blocked: false, word: null };
}
