"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-nabi-surface text-nabi-ink">
        <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-6">
          <h1 className="text-2xl font-bold text-nabi-neon">Al-Nabi</h1>
          <p className="text-sm text-nabi-muted">
            Something went wrong. Our team has been notified.
          </p>
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-cyan-500/20 px-4 py-2 text-sm text-cyan-300"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
