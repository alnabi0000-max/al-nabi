/** Merge incoming search params into a home (`/`) redirect, with optional extras. */
export function homeRedirectFromSearch(
  searchParams: Record<string, string | string[] | undefined>,
  extra?: Record<string, string>
): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) q.append(key, item);
    } else {
      q.set(key, value);
    }
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) q.set(k, v);
  }
  const s = q.toString();
  return s ? `/?${s}` : "/";
}
