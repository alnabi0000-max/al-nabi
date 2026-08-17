/**
 * Runtime model endpoint overrides — approved from Admin Dashboard.
 * Stored as JSON under STORAGE_DIR (no Prisma migration required).
 */

import fs from "fs/promises";
import fsSync from "fs";
import path from "path";

export type ModelSlot =
  | "flux"
  | "sd35"
  | "kling25"
  | "kling3"
  | "lumaRay2"
  | "runway"
  | "wan"
  | "minimax";

export type PendingModelUpdate = {
  id: string;
  slot: ModelSlot;
  /** White-label name for admin UI */
  displayName: string;
  currentModelId: string;
  proposedModelId: string;
  proposedVersionLabel: string;
  messageUz: string;
  messageEn: string;
  status: "pending" | "approved" | "dismissed";
  detectedAt: string;
  approvedAt?: string;
};

export type ModelRegistryState = {
  overrides: Partial<Record<ModelSlot, string>>;
  pending: PendingModelUpdate[];
  lastWatchAt?: string;
};

const DEFAULT_STATE: ModelRegistryState = {
  overrides: {},
  pending: [],
};

function storePath() {
  const root = process.env.STORAGE_DIR || "./storage";
  return path.join(root, "admin", "model-registry.json");
}

async function ensureDir() {
  await fs.mkdir(path.dirname(storePath()), { recursive: true });
}

export async function readModelRegistry(): Promise<ModelRegistryState> {
  try {
    const raw = await fs.readFile(storePath(), "utf8");
    const parsed = JSON.parse(raw) as ModelRegistryState;
    return {
      overrides: parsed.overrides || {},
      pending: Array.isArray(parsed.pending) ? parsed.pending : [],
      lastWatchAt: parsed.lastWatchAt,
    };
  } catch {
    return { ...DEFAULT_STATE, overrides: {}, pending: [] };
  }
}

export async function writeModelRegistry(
  state: ModelRegistryState
): Promise<void> {
  await ensureDir();
  await fs.writeFile(storePath(), JSON.stringify(state, null, 2), "utf8");
}

/** Sync read for hot path — in-memory cache (refreshed on approve / watch) */
let cache: ModelRegistryState | null = null;
let cacheAt = 0;

export function getResolvedModelId(slot: ModelSlot): string | null {
  if (!cache || Date.now() - cacheAt > 30_000) {
    try {
      const raw = fsSync.readFileSync(storePath(), "utf8");
      cache = JSON.parse(raw) as ModelRegistryState;
      cacheAt = Date.now();
    } catch {
      /* no file yet */
    }
  }
  return cache?.overrides[slot]?.trim() || null;
}

/** Warm cache (call from watcher / approve / server boot) */
export async function refreshModelRegistryCache(): Promise<ModelRegistryState> {
  cache = await readModelRegistry();
  cacheAt = Date.now();
  return cache;
}

// Warm once on module load (non-blocking)
void refreshModelRegistryCache().catch(() => undefined);

export async function approvePendingUpdate(
  pendingId: string
): Promise<PendingModelUpdate | null> {
  const state = await readModelRegistry();
  const item = state.pending.find((p) => p.id === pendingId);
  if (!item || item.status !== "pending") return null;

  state.overrides[item.slot] = item.proposedModelId;
  item.status = "approved";
  item.approvedAt = new Date().toISOString();
  await writeModelRegistry(state);
  await refreshModelRegistryCache();
  return item;
}

export async function dismissPendingUpdate(
  pendingId: string
): Promise<boolean> {
  const state = await readModelRegistry();
  const item = state.pending.find((p) => p.id === pendingId);
  if (!item || item.status !== "pending") return false;
  item.status = "dismissed";
  await writeModelRegistry(state);
  await refreshModelRegistryCache();
  return true;
}

export async function addPendingUpdate(
  update: Omit<PendingModelUpdate, "id" | "status" | "detectedAt">
): Promise<PendingModelUpdate | null> {
  const state = await readModelRegistry();
  const exists = state.pending.some(
    (p) =>
      p.status === "pending" &&
      p.slot === update.slot &&
      p.proposedModelId === update.proposedModelId
  );
  if (exists) return null;

  const item: PendingModelUpdate = {
    ...update,
    id: `upd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    status: "pending",
    detectedAt: new Date().toISOString(),
  };
  state.pending.unshift(item);
  state.pending = state.pending.slice(0, 50);
  await writeModelRegistry(state);
  await refreshModelRegistryCache();
  return item;
}

/** Watched slots → public Al-Nabi name + default upstream id */
export const WATCHED_MODELS: Array<{
  slot: ModelSlot;
  displayName: string;
  defaultModelId: string;
  envKey: string;
}> = [
  {
    slot: "kling25",
    displayName: "Cinematic",
    defaultModelId: "kwaivgi/kling-v2.5-turbo-pro",
    envKey: "REPLICATE_KLING_V25_MODEL",
  },
  {
    slot: "kling3",
    displayName: "Flagship",
    defaultModelId: "kwaivgi/kling-v3-video",
    envKey: "REPLICATE_KLING_V3_MODEL",
  },
  {
    slot: "lumaRay2",
    displayName: "Motion Pro",
    defaultModelId: "luma/ray",
    envKey: "REPLICATE_LUMA_MODEL",
  },
  {
    slot: "wan",
    displayName: "Stream",
    defaultModelId: "wan-video/wan-2.2-t2v-fast",
    envKey: "REPLICATE_WAN_MODEL",
  },
  {
    slot: "runway",
    displayName: "Cinema Sound",
    defaultModelId: "kwaivgi/kling-v2.6",
    envKey: "REPLICATE_RUNWAY_MODEL",
  },
];

export function currentModelIdForSlot(
  slot: ModelSlot,
  defaults: typeof WATCHED_MODELS
): string {
  const watched = defaults.find((w) => w.slot === slot);
  const envVal = watched ? process.env[watched.envKey]?.trim() : "";
  return (
    getResolvedModelId(slot) ||
    envVal ||
    watched?.defaultModelId ||
    ""
  );
}
