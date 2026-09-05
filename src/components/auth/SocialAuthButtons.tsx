"use client";

import { useEffect, useState } from "react";
import { useMaster } from "@/context/MasterControllerContext";
import { createClient } from "@/lib/supabase/client";
import { fetchWithTimeout } from "@/lib/api/fetch-timeout";
import { shouldOfferGoogleOAuth } from "@/lib/auth/oauth-providers";
import {
  canonicalOAuthHref,
  canonicalOAuthOrigin,
  GOOGLE_OAUTH_RESUME_KEY,
  normalizePublicOrigin,
  safeOAuthNextPath,
} from "@/lib/auth/oauth-origin";
import clsx from "clsx";

type Props = {
  next?: string;
  className?: string;
  compact?: boolean;
};

/**
 * Google uses the shared browser Supabase client (`@supabase/ssr`).
 * Apple stays off the guest form until the provider is actually enabled —
 * a dead "coming soon" button was confusing first-time sign-up.
 */
export function SocialAuthButtons({
  next = "/",
  className,
}: Props) {
  const { tr, notify } = useMaster();
  const [busyGoogle, setBusyGoogle] = useState(false);
  const nextPath = safeOAuthNextPath(next);

  async function startGoogleOAuth(returnTo: string) {
    try {
      setBusyGoogle(true);
      const rewriteTo = canonicalOAuthHref(window.location);
      if (rewriteTo) {
        /*
         * PKCE cookies are host-scoped. Starting on 0.0.0.0 / 127.0.0.1 and
         * returning to localhost drops the verifier, so hop to localhost first
         * and resume the click automatically.
         */
        try {
          sessionStorage.setItem(GOOGLE_OAUTH_RESUME_KEY, returnTo);
        } catch {
          /* private mode */
        }
        window.location.replace(rewriteTo);
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

      let probe: { google?: boolean } | null = null;
      try {
        const probeRes = await fetchWithTimeout(
          "/api/auth/oauth/providers?provider=google",
          { credentials: "include" },
          4_000
        );
        probe = probeRes.ok
          ? ((await probeRes.json().catch(() => null)) as {
              google?: boolean;
            } | null)
          : null;
      } catch {
        probe = null;
      }
      if (!shouldOfferGoogleOAuth(probe)) {
        notify({
          message: tr("auth_google_coming_soon"),
          type: "info",
          durationMs: 5200,
        });
        return;
      }

      const { origin } = canonicalOAuthOrigin(window.location);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${normalizePublicOrigin(origin)}/auth/callback?next=${encodeURIComponent(returnTo)}`,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
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

  useEffect(() => {
    try {
      const resume = sessionStorage.getItem(GOOGLE_OAUTH_RESUME_KEY);
      if (!resume) return;
      sessionStorage.removeItem(GOOGLE_OAUTH_RESUME_KEY);
      void startGoogleOAuth(safeOAuthNextPath(resume));
    } catch {
      /* private mode */
    }
    // Resume at most once after a loopback rewrite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={clsx("grid grid-cols-1 gap-2", className)}>
      <button
        type="button"
        onClick={() => void startGoogleOAuth(nextPath)}
        disabled={busyGoogle}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-nabi-border bg-white px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:opacity-50"
      >
        <GoogleIcon />
        {tr("continue_google")}
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
