import type { NextRequest } from "next/server";
import { ensureRequestLedgerUser } from "@/lib/auth/ensure-request-user";

export function hasCredentialInQuery(req: NextRequest): boolean {
  return ["key", "alnabiyKey", "alnabiy_key"].some((name) =>
    req.nextUrl.searchParams.has(name)
  );
}

export function isSafeProjectId(value: string): boolean {
  return Boolean(value) && value.length <= 100 && !value.includes("..") && !/[\\/]/.test(value);
}

/**
 * Project APIs use the same cookie/bearer-first authorization as generation
 * and private-media APIs. Legacy key headers remain local-development only.
 */
export async function requireProjectUser(req: NextRequest) {
  return ensureRequestLedgerUser({
    alnabiyKey: req.headers.get("x-alnabiy-key"),
    allowGuest: false,
    request: req,
  });
}
