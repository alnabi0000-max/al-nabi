/**
 * Periodic model-release watcher.
 * Uses OpenRouter (gpt-4o-mini) + Replicate model metadata to detect updates.
 */

import {
  openRouterChat,
  getOpenRouterApiKey,
  getWatcherModel,
} from "@/lib/ai/openrouter";
import { getReplicateApiKey } from "@/lib/replicate";
import { sendTelegramMessage } from "@/lib/telegram/notify";
import {
  WATCHED_MODELS,
  addPendingUpdate,
  currentModelIdForSlot,
  readModelRegistry,
  refreshModelRegistryCache,
  writeModelRegistry,
  type ModelSlot,
} from "@/lib/admin/model-registry";

/**
 * Curated "known newer" candidates (white-label mapped).
 * Watcher compares these to active endpoints; OpenRouter drafts the admin notice.
 */
const KNOWN_UPSTREAM: Partial<
  Record<ModelSlot, Array<{ id: string; label: string }>>
> = {
  kling25: [
    { id: "kwaivgi/kling-v2.5-turbo-pro", label: "2.5 Turbo Pro" },
    { id: "kwaivgi/kling-v2.6", label: "2.6" },
  ],
  kling3: [
    { id: "kwaivgi/kling-v3-video", label: "Video 3.0" },
    { id: "kwaivgi/kling-v3-omni-video", label: "3.0 Omni" },
  ],
  lumaRay2: [
    { id: "luma/ray", label: "Ray" },
    { id: "luma/ray-flash-2", label: "Ray Flash 2" },
  ],
  wan: [
    { id: "wan-video/wan-2.2-t2v-fast", label: "Wan 2.2 Fast" },
    { id: "wan-video/wan-2.2-t2v-720p", label: "Wan 2.2 720p" },
  ],
  flux: [
    { id: "black-forest-labs/flux-2-pro", label: "FLUX.2 Pro" },
    { id: "black-forest-labs/flux-1.1-pro", label: "FLUX 1.1 Pro" },
  ],
  minimax: [
    { id: "minimax/hailuo-02", label: "Hailuo 02" },
  ],
};

async function fetchReplicateLatest(
  modelId: string
): Promise<string | null> {
  const token = getReplicateApiKey();
  if (!token || !modelId.includes("/")) return null;
  const [owner, name] = modelId.split("/");
  try {
    const res = await fetch(
      `https://api.replicate.com/v1/models/${owner}/${name}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(12_000),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      latest_version?: { id?: string };
    };
    return data.latest_version?.id || null;
  } catch {
    return null;
  }
}

async function craftAdminMessage(opts: {
  displayName: string;
  currentModelId: string;
  proposedModelId: string;
  proposedVersionLabel: string;
}): Promise<{ uz: string; en: string }> {
  const fallbackUz = `Al-Nabi Admin: Yangi ${opts.displayName} (${opts.proposedVersionLabel}) versiyasi aniqlandi. Tizimga ulashni tasdiqlaysizmi?`;
  const fallbackEn = `Al-Nabi Admin: New ${opts.displayName} version (${opts.proposedVersionLabel}) detected. Approve connecting it to the system?`;

  if (!getOpenRouterApiKey()) {
    return { uz: fallbackUz, en: fallbackEn };
  }

  try {
    const raw = await openRouterChat({
      model: getWatcherModel(),
      temperature: 0.2,
      json: true,
      timeoutMs: 20_000,
      messages: [
        {
          role: "system",
          content:
            'Return JSON {"uz":"...","en":"..."}. Short admin alerts. Uzbek + English. Do not mention Replicate/Fal/OpenRouter. Brand as Al-Nabi. Include ask to approve.',
        },
        {
          role: "user",
          content: `Display name: ${opts.displayName}\nCurrent endpoint: ${opts.currentModelId}\nProposed: ${opts.proposedModelId}\nVersion label: ${opts.proposedVersionLabel}`,
        },
      ],
    });
    if (!raw) return { uz: fallbackUz, en: fallbackEn };
    const parsed = JSON.parse(raw) as { uz?: string; en?: string };
    return {
      uz: parsed.uz?.trim() || fallbackUz,
      en: parsed.en?.trim() || fallbackEn,
    };
  } catch {
    return { uz: fallbackUz, en: fallbackEn };
  }
}

export type WatchRunResult = {
  checked: number;
  created: number;
  pendingIds: string[];
  telegramSent: boolean;
};

/**
 * Scan watched video slots for candidate updates → pending + Telegram.
 */
export async function runModelWatchCycle(): Promise<WatchRunResult> {
  await refreshModelRegistryCache();
  const state = await readModelRegistry();
  let created = 0;
  const pendingIds: string[] = [];

  for (const watched of WATCHED_MODELS) {
    const current = currentModelIdForSlot(watched.slot, WATCHED_MODELS);
    const candidates = KNOWN_UPSTREAM[watched.slot] || [];

    // Prefer a candidate that differs from current
    const newer =
      candidates.find((c) => c.id !== current) ||
      candidates[candidates.length - 1];
    if (!newer || newer.id === current) {
      // Still probe Replicate latest version hash as soft signal
      const latestHash = await fetchReplicateLatest(current);
      if (!latestHash) continue;
      // Version hash alone isn't a model swap — skip unless env forces demo
      if (process.env.MODEL_WATCH_DEMO !== "1") continue;
    }

    const proposed = newer && newer.id !== current ? newer : null;
    if (!proposed) continue;

    const messages = await craftAdminMessage({
      displayName: watched.displayName,
      currentModelId: current,
      proposedModelId: proposed.id,
      proposedVersionLabel: proposed.label,
    });

    const item = await addPendingUpdate({
      slot: watched.slot,
      displayName: watched.displayName,
      currentModelId: current,
      proposedModelId: proposed.id,
      proposedVersionLabel: proposed.label,
      messageUz: messages.uz,
      messageEn: messages.en,
    });

    if (item) {
      created += 1;
      pendingIds.push(item.id);
      const text = `${item.messageUz}\n\n${item.messageEn}\n\nSlot: ${item.displayName}\n→ ${item.proposedModelId}`;
      await sendTelegramMessage(text);
    }
  }

  // Demo mode: if nothing differed, emit one synthetic pending for Cinematic Pro
  if (created === 0 && process.env.MODEL_WATCH_DEMO === "1") {
    const watched = WATCHED_MODELS[1] || WATCHED_MODELS[0]!;
    const current = currentModelIdForSlot(watched.slot, WATCHED_MODELS);
    const proposedId = `${current}-update-candidate`;
    const messages = await craftAdminMessage({
      displayName: watched.displayName,
      currentModelId: current,
      proposedModelId: proposedId,
      proposedVersionLabel: "v-next",
    });
    const item = await addPendingUpdate({
      slot: watched.slot,
      displayName: watched.displayName,
      currentModelId: current,
      proposedModelId: proposedId,
      proposedVersionLabel: "v-next",
      messageUz: messages.uz,
      messageEn: messages.en,
    });
    if (item) {
      created += 1;
      pendingIds.push(item.id);
      await sendTelegramMessage(
        `${item.messageUz}\n\n${item.messageEn}\n\n(Demo watch cycle)`
      );
    }
  }

  state.lastWatchAt = new Date().toISOString();
  const fresh = await readModelRegistry();
  fresh.lastWatchAt = state.lastWatchAt;
  await writeModelRegistry(fresh);

  return {
    checked: WATCHED_MODELS.length,
    created,
    pendingIds,
    telegramSent: created > 0,
  };
}
