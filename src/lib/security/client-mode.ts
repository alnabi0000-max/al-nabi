/**
 * Client-side: local/dev — agressiv DRM / data-saver bloklari o‘chiq.
 */

export function isSoftClientSecurity(): boolean {
  if (typeof process === "undefined") return false;
  if (process.env.NODE_ENV === "development") return true;
  if (process.env.NEXT_PUBLIC_ALNABIY_MODE === "development") return true;
  if (process.env.NEXT_PUBLIC_AUTH_MODE === "local") return true;
  return false;
}

/** Localhost / LAN — mobil data saver video blokini o‘chirish */
export function isLocalDevHost(): boolean {
  if (typeof window === "undefined") return isSoftClientSecurity();
  const host = window.location.hostname;
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local") ||
    /^192\.168\./.test(host) ||
    /^10\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    return true;
  }
  return isSoftClientSecurity();
}

/** Preview/autoplay uchun data-saver e’tiborsiz */
export function shouldBypassLowDataMode(): boolean {
  if (process.env.NEXT_PUBLIC_DISABLE_LOW_DATA === "1") return true;
  return isLocalDevHost();
}
