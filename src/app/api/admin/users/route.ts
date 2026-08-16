import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiJson, formatRouteError } from "@/lib/api/json-response";
import { requireAdminApiUser } from "@/lib/admin/require-admin";
import {
  AdminOpsError,
  adjustAdminUserNc,
  loadAdminUsers,
  updateAdminUserRole,
  updateAdminUserStatus,
} from "@/lib/admin/ops";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiUser(req);
  if ("response" in auth) return auth.response;

  try {
    const url = new URL(req.url);
    const page = Number(url.searchParams.get("page") || "1");
    const payload = await loadAdminUsers({
      q: url.searchParams.get("q") || undefined,
      page: Number.isFinite(page) ? page : 1,
    });
    return apiJson({ success: true, ok: true, ...payload });
  } catch (e) {
    const formatted = formatRouteError(e);
    return apiError(formatted.message, {
      status: formatted.status,
      code: formatted.code,
    });
  }
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("status"),
    userId: z.string().uuid(),
    status: z.enum(["ACTIVE", "WARNING", "BANNED"]),
  }),
  z.object({
    action: z.literal("role"),
    userId: z.string().uuid(),
    role: z.enum(["USER", "MODERATOR", "ADMIN"]),
  }),
  z.object({
    action: z.literal("adjust_nc"),
    userId: z.string().uuid(),
    delta: z.number().int(),
    reason: z.string().max(200).optional(),
  }),
]);

export async function PATCH(req: NextRequest) {
  const auth = await requireAdminApiUser(req);
  if ("response" in auth) return auth.response;

  try {
    const body = patchSchema.parse(await req.json());
    if (body.action === "status") {
      const user = await updateAdminUserStatus({
        userId: body.userId,
        actorId: auth.user.id,
        status: body.status,
      });
      return apiJson({ success: true, ok: true, user });
    }
    if (body.action === "role") {
      const user = await updateAdminUserRole({
        userId: body.userId,
        actorId: auth.user.id,
        role: body.role,
      });
      return apiJson({ success: true, ok: true, user });
    }
    const user = await adjustAdminUserNc({
      userId: body.userId,
      delta: body.delta,
      reason: body.reason,
    });
    return apiJson({ success: true, ok: true, user });
  } catch (e) {
    if (e instanceof AdminOpsError) {
      return apiError(e.message, { status: 400, code: e.code });
    }
    const formatted = formatRouteError(e);
    return apiError(formatted.message, {
      status: formatted.status,
      code: formatted.code,
    });
  }
}
