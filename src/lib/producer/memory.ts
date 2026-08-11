/**
 * Long-term Producer Chat memory (per user / guest device).
 */

import fs from "fs/promises";
import path from "path";

export type ProducerMemory = {
  preferredAspect?: "16:9" | "9:16" | "1:1";
  preferredNarration?: string;
  preferredStyles: string[];
  recentBriefs: string[];
  visualTone?: string;
  updatedAt: string;
};

function memoryPath(userKey: string) {
  const root = process.env.STORAGE_DIR || "./storage";
  const safe = userKey.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "guest";
  return path.join(root, "producer", "memory", `${safe}.json`);
}

export async function loadProducerMemory(
  userKey: string
): Promise<ProducerMemory> {
  try {
    const raw = await fs.readFile(memoryPath(userKey), "utf8");
    return JSON.parse(raw) as ProducerMemory;
  } catch {
    return {
      preferredStyles: [],
      recentBriefs: [],
      updatedAt: new Date().toISOString(),
    };
  }
}

export async function saveProducerMemory(
  userKey: string,
  patch: Partial<ProducerMemory>
): Promise<ProducerMemory> {
  const prev = await loadProducerMemory(userKey);
  const next: ProducerMemory = {
    ...prev,
    ...patch,
    preferredStyles: Array.from(
      new Set([
        ...(patch.preferredStyles || []),
        ...prev.preferredStyles,
      ])
    ).slice(0, 12),
    recentBriefs: [
      ...(patch.recentBriefs || []),
      ...prev.recentBriefs,
    ].slice(0, 20),
    updatedAt: new Date().toISOString(),
  };
  const p = memoryPath(userKey);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(next, null, 2), "utf8");
  return next;
}
