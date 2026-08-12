/** Profile page top-level sections (URL: ?tab=) */
export type ProfileTab = "umumiy" | "kabinet" | "dokon";

const VALID: ReadonlySet<string> = new Set(["umumiy", "kabinet", "dokon"]);

export function parseProfileTab(raw: string | null | undefined): ProfileTab {
  if (raw && VALID.has(raw)) return raw as ProfileTab;
  return "umumiy";
}

/** Build /profile URL with optional tab + extra query params. */
export function profileHref(
  tab: ProfileTab = "umumiy",
  extra?: Record<string, string | undefined | null>
): string {
  const q = new URLSearchParams();
  if (tab !== "umumiy") q.set("tab", tab);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v != null && v !== "") q.set(k, v);
    }
  }
  const s = q.toString();
  return s ? `/profile?${s}` : "/profile";
}

/** Merge incoming search params into a profile tab redirect target. */
export function profileRedirectFromSearch(
  tab: "kabinet" | "dokon",
  searchParams: Record<string, string | string[] | undefined>
): string {
  const q = new URLSearchParams();
  q.set("tab", tab);
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "tab" || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) q.append(key, item);
    } else {
      q.set(key, value);
    }
  }
  return `/profile?${q.toString()}`;
}
