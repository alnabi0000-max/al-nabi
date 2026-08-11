import * as Sentry from "@sentry/nextjs";

const dsn =
  process.env.SENTRY_DSN?.trim() ||
  process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
const isProd = process.env.NODE_ENV === "production";

if (dsn && isProd) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_ALNABIY_MODE ||
      process.env.NODE_ENV ||
      "production",
    tracesSampleRate: 0.1,
    enabled: true,
  });
}
