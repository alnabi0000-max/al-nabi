"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";
import { LOCALE_STORAGE } from "@/lib/i18n/config";
import { resolveLocale, t } from "@/lib/i18n/messages";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [locale, setLocale] = useState("en");

  useEffect(() => {
    Sentry.captureException(error);

    try {
      setLocale(resolveLocale(localStorage.getItem(LOCALE_STORAGE)));
    } catch {
      /* Use the English fallback before a locale is available. */
    }
  }, [error]);

  return (
    <html lang={locale}>
      <body className="bg-nabi-surface text-nabi-ink">
        <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-6">
          <h1 className="text-2xl font-bold text-nabi-neon">Al-Nabi</h1>
          <p className="text-sm text-nabi-muted">
            {t(locale, "global_error_description")}
          </p>
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-cyan-500/20 px-4 py-2 text-sm text-cyan-300"
          >
            {t(locale, "try_again")}
          </button>
        </div>
      </body>
    </html>
  );
}
