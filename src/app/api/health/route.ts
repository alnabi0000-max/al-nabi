import { apiJson } from "@/lib/api/json-response";
import { getHealthReport } from "@/lib/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Public liveness probe — no user data, no secrets. */
export async function GET() {
  const health = await getHealthReport();
  return apiJson(health, { status: health.ok ? 200 : 503 });
}
