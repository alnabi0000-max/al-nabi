"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { RefreshCw, Home } from "lucide-react";

/**
 * Route-segment error boundary — catches unhandled render/render-time errors
 * anywhere under the app (except the root layout itself, see global-error.tsx)
 * so users get a branded recovery screen instead of a blank/white page.
 */
export default function ErrorBoundary({
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
    <div className="mx-auto flex min-h-[60dvh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-nabi-neon">
        Al-Nabi
      </p>
      <h1 className="text-xl font-bold text-white">Something went wrong</h1>
      <p className="text-sm text-nabi-muted">
        An unexpected error occurred while loading this page. You can try
        again, or head back to the home page.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-xl bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/30"
        >
          <RefreshCw size={16} />
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-nabi-border px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
        >
          <Home size={16} />
          Go home
        </Link>
      </div>
    </div>
  );
}
