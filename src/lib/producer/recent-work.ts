/**
 * Distilled recent work lines for Producer Chat system prompt.
 * Silent context — model uses only when user continues / asks about prior work.
 */

import { prisma } from "@/lib/prisma";
import {
  durationBucketFromSec,
  extractInterestObservation,
} from "@/lib/producer/interest-profile";

function relativeAge(iso: Date, now = new Date()): string {
  const ms = Math.max(0, now.getTime() - iso.getTime());
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) return "bir necha daqiqa oldin";
  if (hours < 24) return `${hours} soat oldin`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 kun oldin";
  if (days < 14) return `${days} kun oldin`;
  return iso.toISOString().slice(0, 10);
}

function durationLabel(sec: number | null | undefined): string | null {
  if (sec == null || sec <= 0) return null;
  const bucket = durationBucketFromSec(sec);
  if (bucket === "short") return `${sec}s qisqa`;
  if (bucket === "medium") return `${sec}s`;
  return `${sec}s uzunroq`;
}

export function distillRecentWorkLine(g: {
  prompt: string | null;
  script: string | null;
  style: string | null;
  durationSec: number;
  type: string;
  status: string;
  createdAt: Date;
}): string {
  const text = (g.prompt || g.script || "").replace(/\s+/g, " ").trim();
  const extracted = extractInterestObservation({
    prompt: text,
    style: g.style,
    durationSec: g.durationSec,
  });
  const topic = extracted.topics[0];
  const style = extracted.styles[0] || (g.style || "").trim().toLowerCase() || null;
  const dur = durationLabel(g.durationSec);
  const kind = g.type.includes("IMAGE") && !g.type.includes("VIDEO")
    ? "rasm"
    : "video";
  const bits = [
    dur,
    style,
    topic ? `${topic} mavzusida` : null,
    kind,
    relativeAge(g.createdAt),
  ].filter(Boolean);
  const titleHint = text
    ? `"${text.slice(0, 48)}${text.length > 48 ? "…" : ""}"`
    : null;
  return `Oxirgi ish: ${bits.join(", ")}${titleHint ? ` · ${titleHint}` : ""} [${g.status}]`;
}

/** Up to 3 completed-or-recent jobs as short system-prompt lines. */
export async function loadRecentWorkPromptBlock(
  userId: string,
  limit = 3
): Promise<string | null> {
  try {
    const rows = await prisma.generation.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: Math.max(1, Math.min(5, limit)),
      select: {
        prompt: true,
        script: true,
        style: true,
        durationSec: true,
        type: true,
        status: true,
        createdAt: true,
      },
    });
    if (!rows.length) return null;
    const lines = rows.map((g, i) => `${i + 1}) ${distillRecentWorkLine(g)}`);
    return lines.join("\n");
  } catch {
    return null;
  }
}
