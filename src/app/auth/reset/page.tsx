"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMaster } from "@/context/MasterControllerContext";
import Link from "next/link";

/**
 * Recovery email → yangi parol o‘rnatish (in-app).
 */
export default function AuthResetPage() {
  const { tr, notify } = useMaster();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      if (!supabase) {
        setErr(tr("auth_supabase_required"));
        return;
      }

      const code =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("code")
          : null;

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.warn("[Alnabiy] reset exchange", error.message);
        }
      }

      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setReady(true);
      } else {
        /* detectSessionInUrl / hash — qisqa kutish */
        await new Promise((r) => setTimeout(r, 400));
        const again = await supabase.auth.getSession();
        if (cancelled) return;
        if (again.data.session) setReady(true);
        else setErr(tr("reset_session_missing"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tr]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password.length < 6) {
      setErr(tr("password_placeholder"));
      return;
    }
    if (password !== confirm) {
      setErr(tr("password_mismatch"));
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error(tr("auth_supabase_required"));
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      notify({ message: tr("password_updated"), type: "success" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : tr("auth_error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-nabi-neon">
          Al-Nabi
        </p>
        <h1 className="text-2xl font-bold">{tr("reset_password_title")}</h1>
        <p className="text-sm text-nabi-muted">{tr("reset_password_subtitle")}</p>
      </div>

      {done ? (
        <div className="nabi-card space-y-3">
          <p className="text-sm text-nabi-neon">{tr("password_updated")}</p>
          <Link href="/profile?tab=kabinet" className="nabi-btn-primary inline-flex">
            {tr("go_dashboard")}
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="nabi-card space-y-3">
          {!ready && !err && (
            <p className="text-xs text-zinc-500">{tr("checking")}</p>
          )}
          <input
            className="nabi-input"
            type="password"
            placeholder={tr("new_password_placeholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            disabled={!ready || loading}
          />
          <input
            className="nabi-input"
            type="password"
            placeholder={tr("confirm_password_placeholder")}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            disabled={!ready || loading}
          />
          <button
            type="submit"
            disabled={!ready || loading}
            className="nabi-btn-primary w-full"
          >
            {loading ? tr("checking") : tr("save_new_password")}
          </button>
          {err && <p className="text-xs text-rose-400">{err}</p>}
        </form>
      )}
    </div>
  );
}
