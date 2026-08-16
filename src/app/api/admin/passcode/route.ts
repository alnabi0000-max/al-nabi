import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiJson, formatRouteError } from "@/lib/api/json-response";
import { requireAdminApiUser } from "@/lib/admin/require-admin";
import { attachAdminGateCookie } from "@/lib/admin/gate-cookie";
import {
  getAdminSettings,
  MAX_PASSCODE_LENGTH,
  MIN_PASSCODE_LENGTH,
  rotateAdminPasscode,
  verifyPasscodeHash,
} from "@/lib/admin/passcode";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  currentPasscode: z.string().min(1).max(MAX_PASSCODE_LENGTH),
  newPasscode: z
    .string()
    .min(MIN_PASSCODE_LENGTH)
    .max(MAX_PASSCODE_LENGTH),
  confirmPasscode: z.string().min(1).max(MAX_PASSCODE_LENGTH),
});

/**
 * POST /api/admin/passcode
 * Rotate the hashed master passcode. Requires a live ADMIN session + gate cookie.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdminApiUser(req);
  if ("response" in auth) return auth.response;

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch (e) {
    const formatted = formatRouteError(e);
    return apiError(formatted.message, {
      status: formatted.status,
      code: formatted.code,
    });
  }

  if (body.newPasscode !== body.confirmPasscode) {
    return apiError("New passcode and confirmation do not match", {
      status: 400,
      code: "PASSCODE_MISMATCH",
    });
  }

  try {
    const settings = await getAdminSettings();
    const currentOk = await verifyPasscodeHash(
      body.currentPasscode,
      settings?.passcodeHash
    );
    if (!currentOk || !settings) {
      return apiError("Invalid passcode", {
        status: 401,
        code: "INVALID_PASSCODE",
      });
    }

    const next = await rotateAdminPasscode({
      newPasscode: body.newPasscode,
      updatedById: auth.user.id,
    });

    const res = apiJson({ ok: true, success: true });
    await attachAdminGateCookie(res, next.tokenVersion);
    return res;
  } catch (e) {
    const formatted = formatRouteError(e);
    return apiError(formatted.message, {
      status: formatted.status,
      code: formatted.code,
    });
  }
}
