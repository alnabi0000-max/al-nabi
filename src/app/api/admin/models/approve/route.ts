import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiJson, formatRouteError } from "@/lib/api/json-response";
import { requireAdminApiUser } from "@/lib/admin/require-admin";
import {
  approvePendingUpdate,
  dismissPendingUpdate,
} from "@/lib/admin/model-registry";
import { sendTelegramMessage } from "@/lib/telegram/notify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  pendingId: z.string().min(3),
  action: z.enum(["approve", "dismiss"]).default("approve"),
});

/**
 * 1-Click Approve & Update API Route — swaps model endpoint via registry override.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdminApiUser(req);
  if ("response" in auth) return auth.response;

  try {
    const body = schema.parse(await req.json());

    if (body.action === "dismiss") {
      const ok = await dismissPendingUpdate(body.pendingId);
      if (!ok) {
        return apiError("Pending update not found", {
          status: 404,
          code: "NOT_FOUND",
        });
      }
      return apiJson({ success: true, ok: true, dismissed: true });
    }

    const item = await approvePendingUpdate(body.pendingId);
    if (!item) {
      return apiError("Pending update not found", {
        status: 404,
        code: "NOT_FOUND",
      });
    }

    await sendTelegramMessage(
      `Al-Nabi Admin: ✅ ${item.displayName} yangilandi / updated → ${item.proposedModelId}`
    );

    return apiJson({
      success: true,
      ok: true,
      approved: true,
      slot: item.slot,
      displayName: item.displayName,
      modelId: item.proposedModelId,
      message:
        "API route updated via model registry override (core logic unchanged).",
    });
  } catch (e) {
    const formatted = formatRouteError(e);
    return apiError(formatted.message, {
      status: formatted.status,
      code: formatted.code,
    });
  }
}
