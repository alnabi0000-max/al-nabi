import { NextRequest } from "next/server";
import { apiError, apiJson, formatRouteError } from "@/lib/api/json-response";
import { requireAdminApiUser } from "@/lib/admin/require-admin";
import {
  WATCHED_MODELS,
  currentModelIdForSlot,
  readModelRegistry,
  refreshModelRegistryCache,
} from "@/lib/admin/model-registry";
import { runModelWatchCycle } from "@/lib/admin/model-watcher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET — pending updates + active overrides */
export async function GET(req: NextRequest) {
  const auth = await requireAdminApiUser(req);
  if ("response" in auth) return auth.response;

  try {
    await refreshModelRegistryCache();
    const state = await readModelRegistry();
    const active = WATCHED_MODELS.map((w) => ({
      slot: w.slot,
      displayName: w.displayName,
      modelId: currentModelIdForSlot(w.slot, WATCHED_MODELS),
    }));

    return apiJson({
      success: true,
      ok: true,
      lastWatchAt: state.lastWatchAt || null,
      active,
      pending: state.pending.filter((p) => p.status === "pending"),
      history: state.pending.filter((p) => p.status !== "pending").slice(0, 20),
    });
  } catch (e) {
    const formatted = formatRouteError(e);
    return apiError(formatted.message, {
      status: formatted.status,
      code: formatted.code,
    });
  }
}

/** POST — run watch cycle now */
export async function POST(req: NextRequest) {
  const auth = await requireAdminApiUser(req);
  if ("response" in auth) return auth.response;

  try {
    const result = await runModelWatchCycle();
    return apiJson({
      success: true,
      ok: true,
      ...result,
    });
  } catch (e) {
    const formatted = formatRouteError(e);
    return apiError(formatted.message, {
      status: formatted.status,
      code: formatted.code,
    });
  }
}
