"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { RecoveryScreen } from "@/components/RecoveryScreen";

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

  return <RecoveryScreen kind="error" onRetry={reset} />;
}
