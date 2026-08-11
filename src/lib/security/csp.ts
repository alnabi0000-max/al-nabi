/**
 * Content-Security-Policy builder for Al-Nabi.
 * Keep in sync with next.config.js `headers` CSP value.
 *
 * Next.js + Sentry + Stripe need 'unsafe-inline'.
 * 'unsafe-eval' is required for Next/webpack runtime paths in this stack.
 */

export function buildContentSecurityPolicy(isProd: boolean): string {
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    "blob:",
    "https://js.sentry-cdn.com",
    "https://browser.sentry-cdn.com",
    "https://*.sentry.io",
    "https://js.stripe.com",
  ].join(" ");

  const connectSrc = [
    "'self'",
    "https:",
    "wss:",
    "ws:",
    ...(isProd
      ? []
      : [
          "http://127.0.0.1:3000",
          "http://localhost:3000",
          "ws://127.0.0.1:3000",
          "ws://localhost:3000",
        ]),
  ].join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://checkout.stripe.com",
    "frame-ancestors 'none'",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
