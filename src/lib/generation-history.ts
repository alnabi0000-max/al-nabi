import type { EmotionMode, GenerationKind } from "@/lib/credits";
import { LS_HISTORY } from "@/lib/credits";

export interface GenerationRecord {
  id: string;
  kind: GenerationKind;
  title: string;
  /** Re-generate uchun asl prompt */
  prompt?: string | null;
  mediaUrl?: string | null;
  durationSec: number;
  emotionMode: EmotionMode;
  creditsCost: number;
  provider?: string;
  quality?: string | null;
  createdAt: string;
}

export function loadHistory(): GenerationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GenerationRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistory(items: GenerationRecord[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_HISTORY, JSON.stringify(items.slice(0, 80)));
  } catch {}
}

export function pushHistory(
  entry: Omit<GenerationRecord, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  }
): GenerationRecord {
  const record: GenerationRecord = {
    id: entry.id || `gen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    kind: entry.kind,
    title: entry.title,
    prompt: entry.prompt ?? entry.title,
    mediaUrl: entry.mediaUrl,
    durationSec: entry.durationSec,
    emotionMode: entry.emotionMode,
    creditsCost: entry.creditsCost,
    provider: entry.provider,
    quality: entry.quality,
    createdAt: entry.createdAt || new Date().toISOString(),
  };
  const next = [record, ...loadHistory()];
  saveHistory(next);
  return record;
}

export function removeHistoryItem(id: string): GenerationRecord[] {
  const next = loadHistory().filter((x) => x.id !== id);
  saveHistory(next);
  return next;
}

export function totalSpentFromHistory(): number {
  return loadHistory().reduce((sum, x) => sum + (x.creditsCost || 0), 0);
}
