"use client";

import { useState } from "react";
import { useMaster } from "@/context/MasterControllerContext";
import { createClient } from "@/lib/supabase/client";
import { fetchWithTimeout } from "@/lib/api/fetch-timeout";
import { shouldOfferGoogleOAuth } from "@/lib/auth/oauth-providers";
import clsx from "clsx";

type Props = {
  next?: string;
  className?: string;
  compact?: boolean;
};

/** `0.0.0.0` is a server bind address, never a safe browser OAuth origin. */
function canonicalLocalDevUrl(): string | null {
  const { protocol, hostname, port, pathname, search, hash } = window.location;
  if (hostname === "0.0.0.0" || hostname === "::") {
    return `${protocol}//localhost${port ? `:${port}` : ""}${pathname}${search}${hash}`;
  }
  return null;
}

/**
 * Google uses the shared browser Supabase client (`@supabase/ssr`).
 * Apple remains "coming soon".
 */
export function SocialAuthButtons({
  next = "/",
  className,
  compact,
}: Props) {
  const { tr, notify } = useMaster();
  const [busyGoogle, setBusyGoogle] = useState(false);

  async function handleGoogleSignIn() {
    try {
      setBusyGoogle(true);
      const canonicalUrl = canonicalLocalDevUrl();
      if (canonicalUrl) {
        /*
         * PKCE state is stored in origin-scoped cookies. Starting OAuth on
         * 0.0.0.0 and returning to localhost loses that state, so move the
         * page first and let the user start the flow from the canonical URL.
         */
        window.location.replace(canonicalUrl);
        return;
      }

      const supabase = createClient();
      if (!supabase) {
        notify({
          message: tr("auth_supabase_required"),
          type: "error",
          durationMs: 5200,
        });
        return;
      }

      const probeRes = await fetchWithTimeout(
        "/api/auth/oauth/providers?provider=google",
        { credentials: "include" },
        4_000
      );
      const probe = (await probeRes.json().catch(() => null)) as
        | { google?: boolean }
        | null;
      if (!shouldOfferGoogleOAuth(probe)) {
        notify({
          message: tr("auth_google_coming_soon"),
          type: "info",
          durationMs: 5200,
        });
        return;
      }

      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) {
        notify({
          message: error.message || tr("auth_error"),
          type: "error",
          durationMs: 5200,
        });
      }
    } catch {
      notify({
        message: tr("auth_error"),
        type: "error",
        durationMs: 5200,
      });
    } finally {
      setBusyGoogle(false);
    }
  }

  function comingSoon() {
    notify({
      message: tr("auth_apple_coming_soon"),
      type: "info",
      durationMs: 5200,
    });
  }

  return (
    <div
      className={clsx(
        "grid gap-2",
        compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2",
        className
      )}
    >
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={busyGoogle}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-nabi-border bg-white px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:opacity-50"
      >
        <GoogleIcon />
        {tr("continue_google")}
      </button>
      <button
        type="button"
        onClick={comingSoon}
        className="glass-card flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white"
      >
        <AppleIcon />
        {tr("continue_apple")}
      </button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.2C29.3 35.9 26.8 37 24 37c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C39.5 36.3 44 30.7 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="18" viewBox="0 0 384 512" fill="currentColor" aria-hidden>
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 21.1-88.5 21.1-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5c0 26.2 4.8 53.3 14.4 81.2 12.8 36.4 59 125.6 107.2 124.3 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-118.8-65.2-30.7-61.7-90-61.7-91.5zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}
