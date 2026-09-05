"use client";

import { useEffect, useState } from "react";
import { useMaster } from "@/context/MasterControllerContext";
import { LogOut, UserRound } from "lucide-react";
import clsx from "clsx";
import { AccountTrustPanel } from "@/components/AccountTrustPanel";

/**
 * Profile «Umumiy» — signed-in account only.
 * Guest sign-up lives on SplitAuthPage; the old magic-link / key form here
 * was dead weight (guests never reach this page) and a second, conflicting UI.
 */
export function ProfileUmumiyPanel() {
  const {
    email,
    alnabiyKey,
    coins,
    tr,
    signOut,
    authReady,
    isAuthenticated,
    authMode,
  } = useMaster();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const signedIn = Boolean(isAuthenticated && email);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("auth") === "error") setErr(tr("auth_error"));
    if (q.get("auth") === "local") setMsg(tr("auth_local_hint"));
  }, [tr]);

  async function onLogout() {
    setLoading(true);
    try {
      await signOut();
      setMsg(tr("signed_out"));
    } finally {
      setLoading(false);
    }
  }

  if (!authReady) {
    return (
      <div className="py-8 text-sm text-nabi-muted">{tr("checking")}</div>
    );
  }

  if (!signedIn) {
    return (
      <div className="nabi-card text-sm text-nabi-muted">
        {tr("auth_signin_subtitle")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-xl font-bold md:text-2xl">{tr("profile")}</h2>
        <span className="rounded-full border border-nabi-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-nabi-muted">
          {authMode === "supabase" ? "Supabase" : "Local auth"}
        </span>
      </div>

      <div className="nabi-card space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-nabi-muted">
          <UserRound size={16} /> {tr("profile_account_title")}
        </h3>
        <div className="space-y-1 text-sm">
          <p>
            <span className="text-nabi-muted">Email:</span> {email}
          </p>
          <p className="break-all font-mono text-xs text-nabi-neon">
            {alnabiyKey}
          </p>
          <p className="text-[10px] text-nabi-muted">
            {tr("balance_line", { n: coins.toLocaleString() })}
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          disabled={loading}
          className="nabi-btn-ghost flex w-full items-center justify-center gap-2"
        >
          <LogOut size={16} />
          {tr("logout")}
        </button>
      </div>
      <AccountTrustPanel />

      {(msg || err) && (
        <p
          className={clsx("text-xs", err ? "text-red-400" : "text-nabi-neon")}
        >
          {err || msg}
        </p>
      )}
    </div>
  );
}
