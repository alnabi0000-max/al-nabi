import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import {
  forbidden,
  requireApiUser,
  type AuthedContext,
  type GuardFailure,
} from "@/lib/auth/api-guard";
import { ensureRequestLedgerUser } from "@/lib/auth/ensure-request-user";
import type { LedgerUser } from "@/lib/auth/ensure-request-user";
import { isAdminRole } from "@/lib/admin/roles";

export { isAdminRole } from "@/lib/admin/roles";

/** Studio home — unauthorized `/admin` visitors are sent here. */
export const ADMIN_DENIED_REDIRECT = "/";

/**
 * Page-level gate for `/admin/*`.
 * Only Prisma `User.role === ADMIN` may continue; everyone else lands on `/`.
 */
export async function requireAdminPageUser(): Promise<LedgerUser> {
  const ensured = await ensureRequestLedgerUser({ allowGuest: false });
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
 * API gate for financial admin routes — session identity + exact ADMIN role.
 * Does not accept `ADMIN_API_SECRET`; those remain on model-watch endpoints.
 */
export async function requireAdminApiUser(
  request: NextRequest
): Promise<AuthedContext | GuardFailure> {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth;
  if (!isAdminRole(auth.user.role)) {
    return { response: forbidden("Admin access required", "ADMIN_REQUIRED") };
  }
  return auth;
}
