import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";

/**
 * Admin routes: Authorization: Bearer <ADMIN_API_SECRET>
 * or header x-alnabiy-admin-secret
 */
export function assertAdmin(req: NextRequest): { ok: true } | { ok: false; error: string } {
  const secret = process.env.ADMIN_API_SECRET?.trim();
  if (!secret || secret.length < 8) {
    return { ok: false, error: "ADMIN_API_SECRET not configured" };
  }

  const bearer = req.headers.get("authorization");
  const header =
    req.headers.get("x-alnabiy-admin-secret") ||
    (bearer?.toLowerCase().startsWith("bearer ")
      ? bearer.slice(7).trim()
      : null);

  /* Never accept admin secret via query string (Referer/logs leak).
   * Constant-time compare to avoid timing side-channels on the secret. */
  if (header) {
    const a = Buffer.from(header);
    const b = Buffer.from(secret);
    if (a.length === b.length && timingSafeEqual(a, b)) {
      return { ok: true };
    }
  }
  return { ok: false, error: "Unauthorized" };
}

export function adminSecretFromBrowser(): string {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem("alnabiy_admin_secret") || "";
  } catch {
    return "";
  }
}
