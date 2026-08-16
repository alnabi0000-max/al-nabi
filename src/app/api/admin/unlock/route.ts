import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiJson, formatRouteError } from "@/lib/api/json-response";
import { attachAdminGateCookie } from "@/lib/admin/gate-cookie";
import { isAdminRole } from "@/lib/admin/roles";
import {
  getAdminSettings,
  MAX_PASSCODE_LENGTH,
  verifyPasscodeHash,
} from "@/lib/admin/passcode";
import { ensureRequestLedgerUser } from "@/lib/auth/ensure-request-user";
import { clientIp, rateLimitUnlock } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  passcode: z.string().min(1).max(MAX_PASSCODE_LENGTH),
});

/**
 * POST /api/admin/unlock
 * Verifies the master passcode, then issues an encrypted HTTP-only gate cookie.
 * Failures always look the same so a wrong guess does not leak admin existence.
 */
export async function POST(req: NextRequest) {
  const limited = await rateLimitUnlock(clientIp(req));
  if (!limited.success) {
    return apiError("Too many attempts", {
      status: 429,
      code: "RATE_LIMITED",
    });
  }

  let passcode: string;
  try {
    passcode = schema.parse(await req.json()).passcode;
  } catch {
    return apiError("Invalid passcode", {
      status: 401,
      code: "INVALID_PASSCODE",
    });
  }

  try {
    const [settings, ensured] = await Promise.all([
      getAdminSettings(),
      ensureRequestLedgerUser({ request: req, allowGuest: false }).catch(
        () => null
      ),
    ]);

    const passOk = await verifyPasscodeHash(passcode, settings?.passcodeHash);
    const isAdmin = Boolean(
      ensured &&
        ensured.user.status !== "BANNED" &&
        isAdminRole(ensured.user.role)
    );

    if (!passOk || !isAdmin || !settings) {
      return apiError("Invalid passcode", {
        status: 401,
        code: "INVALID_PASSCODE",
      });
    }

    const res = apiJson({ ok: true, success: true });
    await attachAdminGateCookie(res, settings.tokenVersion);
    return res;
  } catch (e) {
    const formatted = formatRouteError(e);
    if (formatted.code === "DB_UNAVAILABLE") {
      return apiError(formatted.message, {
        status: formatted.status,
        code: formatted.code,
      });
    }
    return apiError("Invalid passcode", {
      status: 401,
      code: "INVALID_PASSCODE",
    });
  }
}
