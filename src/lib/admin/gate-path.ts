/**
 * Hidden admin UI paths. API routes under `/api/admin/` are not included —
 * those keep their own secret / session gates.
 */
export function isAdminUiPath(pathname: string): boolean {
  const path =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return path === "/admin" || path.startsWith("/admin/");
}
