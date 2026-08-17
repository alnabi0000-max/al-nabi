/** Public support contacts — never invent a live status page. */

export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "support@alnabiy.app";

export const BILLING_EMAIL =
  process.env.NEXT_PUBLIC_BILLING_EMAIL?.trim() || "billing@alnabiy.app";

export const LEGAL_EMAIL =
  process.env.NEXT_PUBLIC_LEGAL_EMAIL?.trim() || "legal@alnabiy.app";

export const SUPPORT_TELEGRAM_URL =
  process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM?.trim() || "";

export function supportMailto(subject?: string): string {
  const q = subject ? `?subject=${encodeURIComponent(subject)}` : "";
  return `mailto:${SUPPORT_EMAIL}${q}`;
}
