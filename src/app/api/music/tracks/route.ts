import { apiError, apiJson, formatRouteError } from "@/lib/api/json-response";
import { listAmbientTracks } from "@/lib/bgm/catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** List licensed ambient tracks under public/music for the shared BGM picker. */
export async function GET() {
  try {
    const tracks = await listAmbientTracks();
    return apiJson({
      ok: true,
      tracks,
      count: tracks.length,
    });
  } catch (e) {
    const formatted = formatRouteError(e);
    return apiError(formatted.message, {
      status: formatted.status || 500,
      code: formatted.code,
    });
  }
}
