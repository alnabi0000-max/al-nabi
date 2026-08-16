import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import {
  forbidden,
  requireApiUser,
  unauthorized,
  type AuthedContext,
  type GuardFailure,
} from "@/lib/auth/api-guard";
import { ensureRequestLedgerUser } from "@/lib/auth/ensure-request-user";
import type { LedgerUser } from "@/lib/auth/ensure-request-user";
import { isAdminRole } from "@/lib/admin/roles";
import { ADMIN_GATE_COOKIE, readAdminGateToken } from "@/lib/admin/gate-token";
import { getAdminSettings } from "@/lib/admin/passcode";

export { isAdminRole } from "@/lib/admin/roles";

/** Studio home — unauthorized `/admin` visitors are sent here. */
export const ADMIN_DENIED_REDIRECT = "/";

async function hasValidAdminGateCookie(
  request?: NextRequest
): Promise<boolean> {
  try {
    const token = request
      ? request.cookies.get(ADMIN_GATE_COOKIE)?.value
      : (await cookies()).get(ADMIN_GATE_COOKIE)?.value;
    const payload = await readAdminGateToken(token);
    if (!payload) return false;
    const settings = await getAdminSettings();
    if (!settings) return false;
    return payload.v === settings.tokenVersion;
  } catch {
    return false;
  }
}

/**
 * Page-level gate for `/admin/*`.
 * Requires the encrypted gate cookie (Ctrl+Alt+A passcode) AND Prisma ADMIN.
 * Everyone else lands on `/` so the surface stays invisible.
 */
export async function requireAdminPageUser(): Promise<LedgerUser> {
  if (!(await hasValidAdminGateCookie())) {
    redirect(ADMIN_DENIED_REDIRECT);
  }

  let ensured: Awaited<ReturnType<typeof ensureRequestLedgerUser>> = null;
  try {
    ensured = await ensureRequestLedgerUser({ allowGuest: false });
  } catch {
    redirect(ADMIN_DENIED_REDIRECT);
  }

  if (
    ensured &&
    ensured.user.status !== "BANNED" &&
    isAdminRole(ensured.user.role)
  ) {
    return ensured.user;
  }
  redirect(ADMIN_DENIED_REDIRECT);
}

/**
 * API gate for financial admin routes — session identity + exact ADMIN role
 * + a live admin-gate cookie. Does not accept `ADMIN_API_SECRET`.
 */
export async function requireAdminApiUser(
  request: NextRequest
): Promise<AuthedContext | GuardFailure> {
  if (!(await hasValidAdminGateCookie(request))) {
    return { response: unauthorized() };
  }
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth;
  if (!isAdminRole(auth.user.role)) {
    return { response: forbidden("Admin access required", "ADMIN_REQUIRED") };
  }
  return auth;
}
