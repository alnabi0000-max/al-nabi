/**
 * Paths a guest may open without the studio chrome.
 * Everything else renders the split authentication screen.
 */
const EXACT = new Set(["/privacy", "/terms", "/refund-policy"]);

export function isAuthExemptPath(pathname: string): boolean {
  if (!pathname) return false;
  const path =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  if (path.startsWith("/auth/")) return true;
  if (path === "/admin" || path.startsWith("/admin/")) return true;
  return EXACT.has(path);
}
