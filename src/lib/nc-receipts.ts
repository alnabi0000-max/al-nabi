/**
 * Persistent NC spend receipts (cheklar).
 * Survives media-library deletes so the ledger of what NC was spent on remains.
 */

import { STORAGE } from "@/lib/storage-keys";
import {
  HISTORY_CHANGED_EVENT,
  loadHistory,
  type GenerationRecord,
} from "@/lib/generation-history";
import type { GenerationKind } from "@/lib/credits";

export const NC_RECEIPTS_EVENT = HISTORY_CHANGED_EVENT;

export type NcSpendKind = GenerationKind | "vault" | "other";

export interface NcReceipt {
  id: string;
  receiptId?: string;
  kind: NcSpendKind;
  title: string;
  creditsCost: number;
  durationSec?: number;
  quality?: string | null;
  provider?: string | null;
  balanceAfter?: number;
  createdAt: string;
}

const LS = STORAGE.receipts;
const MAX = 120;

function emitChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NC_RECEIPTS_EVENT));
}

function loadStored(): NcReceipt[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as NcReceipt[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStored(items: NcReceipt[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS, JSON.stringify(items.slice(0, MAX)));
  } catch {
    /* quota */
  }
}

function fromHistory(r: GenerationRecord): NcReceipt {
  return {
    id: r.id,
    receiptId: r.receiptId,
    kind: r.kind,
    title: r.title,
    creditsCost: r.creditsCost || 0,
    durationSec: r.durationSec,
    quality: r.quality,
    provider: r.provider,
    createdAt: r.createdAt,
  };
}

function mergeReceipts(lists: NcReceipt[][]): NcReceipt[] {
  const byId = new Map<string, NcReceipt>();
  const receiptToId = new Map<string, string>();

  for (const list of lists) {
    for (const raw of list) {
      if (!raw || !(Number(raw.creditsCost) > 0)) continue;
      const r: NcReceipt = {
        ...raw,
        creditsCost: Number(raw.creditsCost) || 0,
        createdAt: raw.createdAt || new Date().toISOString(),
      };
      const existingId =
        (r.receiptId && receiptToId.get(r.receiptId)) ||
        (byId.has(r.id) ? r.id : undefined);

      if (existingId) {
        const prev = byId.get(existingId)!;
        const merged: NcReceipt = {
          ...prev,
          ...r,
          id: prev.id,
          receiptId: r.receiptId || prev.receiptId,
          kind:
            r.kind && r.kind !== "other"
              ? r.kind
              : prev.kind || r.kind,
          title:
            r.kind && r.kind !== "other" && r.title
              ? r.title
              : prev.title || r.title,
          creditsCost: r.creditsCost || prev.creditsCost,
          durationSec: r.durationSec ?? prev.durationSec,
          quality: r.quality ?? prev.quality,
          provider: r.provider ?? prev.provider,
          balanceAfter: r.balanceAfter ?? prev.balanceAfter,
          createdAt: prev.createdAt || r.createdAt,
        };
        byId.set(existingId, merged);
        if (merged.receiptId) receiptToId.set(merged.receiptId, existingId);
      } else {
        byId.set(r.id, r);
        if (r.receiptId) receiptToId.set(r.receiptId, r.id);
      }
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function toReceipt(
  entry: Omit<NcReceipt, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  }
): NcReceipt {
  return {
    id:
      entry.id ||
      entry.receiptId ||
      `nc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    receiptId: entry.receiptId,
    kind: entry.kind || "other",
    title: (entry.title || "NC").slice(0, 120),
    creditsCost: Math.max(0, Math.round(Number(entry.creditsCost) || 0)),
    durationSec: entry.durationSec,
    quality: entry.quality,
    provider: entry.provider,
    balanceAfter: entry.balanceAfter,
    createdAt: entry.createdAt || new Date().toISOString(),
  };
}

export function upsertNcReceipt(
  entry: Omit<NcReceipt, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  }
): NcReceipt {
  const receipt = toReceipt(entry);
  if (receipt.creditsCost <= 0) return receipt;
  saveStored(mergeReceipts([loadStored(), [receipt]]));
  emitChanged();
  return receipt;
}

export function upsertNcReceipts(
  entries: Array<
    Omit<NcReceipt, "id" | "createdAt"> & { id?: string; createdAt?: string }
  >
) {
  const incoming = entries.map(toReceipt).filter((r) => r.creditsCost > 0);
  if (!incoming.length) return;
  saveStored(mergeReceipts([loadStored(), incoming]));
  emitChanged();
}

export function listNcReceipts(): NcReceipt[] {
  const stored = loadStored();
  const fromGen = loadHistory()
    .filter((x) => (x.creditsCost || 0) > 0)
    .map(fromHistory);
  const merged = mergeReceipts([stored, fromGen]);
  if (merged.length && stored.length !== merged.length) {
    saveStored(merged);
  }
  return merged;
}

export function totalNcSpent(items?: NcReceipt[]): number {
  return (items || listNcReceipts()).reduce(
    (sum, x) => sum + (x.creditsCost || 0),
    0
  );
}

export function subscribeNcReceipts(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => onChange();
  window.addEventListener(NC_RECEIPTS_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(NC_RECEIPTS_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
