/**
 * Fail-closed route guard.
 *
 * `ensureRequestLedgerUser()` resolves a session; this module turns "no
 * session" into a uniform 401 so every protected handler answers the same way.
 * Anything unexpected (Supabase outage, Prisma error) also denies the request —
 * there is no path through this guard that grants access without a verified
 * identity.
 */

import { NextResponse } from "next/server";
import {
  ensureRequestLedgerUser,
  type CredentialSource,
  type LedgerUser,
} from "@/lib/auth/ensure-request-user";
import type { HeaderSource } from "@/lib/auth/bearer";
import type { UserRole } from "@prisma/client";

export type AuthedContext = {
  user: LedgerUser;
  source: CredentialSource;
};

export type GuardFailure = { response: NextResponse };

const ROLE_RANK: Record<UserRole, number> = {
  USER: 0,
  MODERATOR: 1,
  ADMIN: 2,
};

export function unauthorized(
  message = "Sign in required",
  code = "AUTH_REQUIRED"
): NextResponse {
  return NextResponse.json(
    { ok: false, authenticated: false, code, error: message },
    { status: 401, headers: { "Cache-Control": "no-store" } }
  );
}

export function forbidden(
  message = "Insufficient permissions",
  code = "FORBIDDEN"
): NextResponse {
  return NextResponse.json(
    { ok: false, code, error: message },
    { status: 403, headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * Resolve the caller or return a ready-to-send denial.
 *
 * ```ts
 * const auth = await requireApiUser(req);
 * if ("response" in auth) return auth.response;
 * // auth.user is guaranteed present here
 * ```
 */
export async function requireApiUser(
  request?: HeaderSource,
  opts?: { alnabiyKey?: string | null; minRole?: UserRole }
): Promise<AuthedContext | GuardFailure> {
  let ensured: Awaited<ReturnType<typeof ensureRequestLedgerUser>> = null;
  try {
    ensured = await ensureRequestLedgerUser({
      request,
      alnabiyKey: opts?.alnabiyKey,
      allowGuest: false,
    });
  } catch {
    return { response: unauthorized() };
  }

  if (!ensured) return { response: unauthorized() };
  if (ensured.user.status === "BANNED") {
    return { response: forbidden("Account banned", "ACCOUNT_BANNED") };
  }

  const minRole = opts?.minRole;
  if (minRole && ROLE_RANK[ensured.user.role] < ROLE_RANK[minRole]) {
    return { response: forbidden() };
  }

  return { user: ensured.user, source: ensured.source };
}

/** Wrap a route handler so it only ever runs for a verified caller. */
export function withApiAuth<T extends Request>(
  handler: (req: T, ctx: AuthedContext) => Promise<Response> | Response,
  opts?: { minRole?: UserRole }
) {
  return async (req: T): Promise<Response> => {
    const auth = await requireApiUser(req, { minRole: opts?.minRole });
    if ("response" in auth) return auth.response;
    return handler(req, auth);
  };
}
