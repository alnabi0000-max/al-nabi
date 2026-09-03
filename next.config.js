/**
 * Al-Nabi Enterprise Security — next.config.js
 * PHASE 4/5: security headers + optional Sentry wrapper
 */
const { withSentryConfig } = require("@sentry/nextjs");

/**
 * CSP — allow Next/Sentry/Stripe; unsafe-inline + unsafe-eval required by stack.
 * Keep aligned with src/lib/security/csp.ts
 */
function buildContentSecurityPolicy(isProd) {
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
    "frame-src 'self' https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://*.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://checkout.stripe.com https://accounts.google.com https://appleid.apple.com https://*.supabase.co",
    "frame-ancestors 'none'",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  /** SEC-02: production browser source maps o‘chiq */
  productionBrowserSourceMaps: false,
  compress: true,
  reactStrictMode: true,
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production" ? { exclude: ["error"] } : false,
  },
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  redirects: async () => [
    { source: "/kabinet", destination: "/dashboard", permanent: false },
    { source: "/cabinet", destination: "/dashboard", permanent: false },
    { source: "/coin-store", destination: "/store", permanent: false },
    { source: "/coinstore", destination: "/store", permanent: false },
    { source: "/coins", destination: "/store", permanent: false },
  ],
  headers: async () => {
    const isProd = process.env.NODE_ENV === "production";
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: buildContentSecurityPolicy(isProd),
          },
        ],
      },
    ];
  },
  webpack: (config, { dev, isServer }) => {
    /* SEC-02: prod client — eval-source-map o‘rniga yashirin/yo‘q */
    if (!dev) {
      config.devtool = false;
    }
    /**
     * Webpack obfuscation breaks Next.js App Router client bundles
     * (layout/hydration → global-error). Opt-in only via ENABLE_OBFUSCATION=1.
     */
    if (
      !dev &&
      !isServer &&
      process.env.ENABLE_OBFUSCATION === "1"
    ) {
      config.optimization = { ...config.optimization, minimize: true };
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const WebpackObfuscator = require("webpack-obfuscator");
        config.plugins = config.plugins || [];
        config.plugins.push(
          new WebpackObfuscator(
            {
              rotateStringArray: true,
              stringArray: true,
              stringArrayThreshold: 0.75,
              stringArrayEncoding: ["base64"],
              compact: true,
              controlFlowFlattening: false,
              deadCodeInjection: false,
              debugProtection: false,
              disableConsoleOutput: true,
              identifierNamesGenerator: "hexadecimal",
              renameGlobals: false,
              /* selfDefending uses Function/eval — breaks CSP */
              selfDefending: false,
              splitStrings: true,
              splitStringsChunkLength: 8,
              transformObjectKeys: false,
            },
            ["**/node_modules/**"]
          )
        );
      } catch {
        /* optional obfuscator */
      }
    }
    return config;
  },
};

module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG || undefined,
  project: process.env.SENTRY_PROJECT || undefined,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
    automaticVercelMonitors: false,
  },
});
