/** Short forensic id for on-screen preview watermarks. */
export function previewFingerprint(
  email: string | null | undefined,
  key: string | null | undefined
): string {
  const raw = String(email || key || "guest").trim().toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).toUpperCase().padStart(6, "0").slice(0, 6);
}
