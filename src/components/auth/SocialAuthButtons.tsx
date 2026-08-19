"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchWithTimeout } from "@/lib/api/fetch-timeout";
import { createClient } from "@/lib/supabase/client";
import { useMaster } from "@/context/MasterControllerContext";
import clsx from "clsx";

type Props = {
  next?: string;
  className?: string;
  compact?: boolean;
};

type ProviderFlags = {
  google?: boolean;
  apple?: boolean;
};

/**
 * One-click Google & Apple. If a provider is off in GoTrue we toast instead
 * of sending the browser to a raw JSON 400. Probe only the clicked provider
 * with a timeout so Apple cannot freeze the Google button.
 */
export function SocialAuthButtons({
  next = "/",
  className,
  compact,
}: Props) {
  const { tr, notify } = useMaster();
  const [busy, setBusy] = useState<"google" | "apple" | null>(null);

  async function oauth(provider: "google" | "apple") {
    setBusy(provider);
    const label = provider === "google" ? "Google" : "Apple";
    try {
      const supabase = createClient();
      if (!supabase) {
        notify({
          message: tr("auth_supabase_required"),
          type: "error",
        });
        return;
      }

      const origin = window.location.origin;
      const probePromise = fetchWithTimeout(
        `/api/auth/oauth/providers?provider=${provider}`,
        { credentials: "include" },
        4000
      );
      const oauthPromise = supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
          skipBrowserRedirect: true,
          ...(provider === "apple" ? { scopes: "name email" } : {}),
        },
      });

      const [probeRes, oauthResult] = await Promise.all([
        probePromise,
        oauthPromise,
      ]);
      const probe = (await probeRes.json().catch(() => null)) as
        | ProviderFlags
        | null;
      const enabled = Boolean(probeRes.ok && probe && probe[provider] === true);
      if (!enabled) {
        notify({
          message: tr("auth_provider_unavailable", { provider: label }),
          type: "error",
        });
        return;
      }

      if (oauthResult.error) {
        notify({ message: oauthResult.error.message, type: "error" });
        return;
      }
      if (oauthResult.data?.url) {
        window.location.assign(oauthResult.data.url);
        return;
      }
      notify({ message: tr("auth_error"), type: "error" });
    } catch (e) {
      const timedOut =
        e instanceof Error && /timed out/i.test(e.message);
      notify({
        message: timedOut
          ? tr("auth_provider_unavailable", { provider: label })
          : e instanceof Error
            ? e.message
            : tr("auth_error"),
        type: "error",
      });
    } finally {
      setBusy(null);
    }
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
        onClick={() => oauth("google")}
        disabled={busy !== null}
        aria-busy={busy === "google"}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-nabi-border bg-white px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:opacity-50"
      >
        {busy === "google" ? (
          <Loader2 size={16} className="animate-spin" />
        ) : null}
        <GoogleIcon />
        {tr("continue_google")}
      </button>
      <button
        type="button"
        onClick={() => oauth("apple")}
        disabled={busy !== null}
        aria-busy={busy === "apple"}
        className="glass-card flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy === "apple" ? (
          <Loader2 size={16} className="animate-spin" />
        ) : null}
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
