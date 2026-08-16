"use client";

import { useEffect, useState } from "react";
import { useMaster } from "@/context/MasterControllerContext";
import { useAuthUi } from "@/context/AuthUiContext";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";
import { KeyRound, LogOut, Sparkles, UserRound } from "lucide-react";
import { fetchWithTimeout } from "@/lib/api/fetch-timeout";
import { profileHref } from "@/lib/profile-tabs";
import clsx from "clsx";

type AuthTab = "password" | "key" | "magic";

/**
 * Profile «Umumiy» — hisob va auth (oldingi /profile kontenti)
 */
export function ProfileUmumiyPanel() {
  const {
    email,
    alnabiyKey,
    verifyKey,
    coins,
    tr,
    signInWithPassword,
    signOut,
    authReady,
    authMode,
    notify,
  } = useMaster();
  const { openAuth } = useAuthUi();
  const [tab, setTab] = useState<AuthTab>("password");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formKey, setFormKey] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const signedIn = Boolean(email && alnabiyKey);
  const afterAuth = profileHref("kabinet");

  useEffect(() => {
    setFormEmail(email || "");
    setFormKey(alnabiyKey || "");
  }, [email, alnabiyKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("auth") === "error") setErr(tr("auth_error"));
    if (q.get("auth") === "local") setMsg(tr("auth_local_hint"));
  }, [tr]);

  async function onPasswordAuth(register: boolean) {
    setLoading(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await signInWithPassword(formEmail, formPassword, register);
      if (res.ok) setMsg(res.message);
      else setErr(res.message);
    } catch (e) {
      setErr(e instanceof Error ? e.message : tr("auth_error"));
    } finally {
      setLoading(false);
    }
  }

  async function onKeyRestore() {
    setLoading(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await verifyKey(formEmail, formKey);
      if (res.ok) setMsg(res.message);
      else setErr(res.message);
    } catch (e) {
      setErr(e instanceof Error ? e.message : tr("auth_error"));
    } finally {
      setLoading(false);
    }
  }

  async function onMagic() {
    setLoading(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetchWithTimeout(
        "/api/auth/magic-link",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: formEmail, next: afterAuth }),
        },
        20_000
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tr("auth_error"));
      setMsg(tr("magic_link_sent"));
      notify({ message: tr("magic_link_sent"), type: "success" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : tr("auth_error"));
    } finally {
      setLoading(false);
    }
  }

  async function onLogout() {
    setLoading(true);
    try {
      await signOut();
      setMsg(tr("signed_out"));
      setFormPassword("");
    } finally {
      setLoading(false);
    }
  }

  if (!authReady) {
    return (
      <div className="py-8 text-sm text-nabi-muted">{tr("checking")}</div>
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

      {signedIn ? (
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
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-xs text-nabi-muted">{tr("auth_social_hint")}</p>
            <SocialAuthButtons next={afterAuth} />
          </div>

          <div className="relative text-center text-[10px] uppercase tracking-widest text-nabi-muted">
            <span className="relative z-10 bg-nabi-surface px-2">{tr("auth_or")}</span>
            <div className="absolute inset-x-0 top-1/2 h-px bg-nabi-border" />
          </div>

          <div className="nabi-card space-y-4">
            <div className="flex gap-1 rounded-xl bg-nabi-input p-1">
              {(
                [
                  ["password", tr("auth_tab_password")],
                  ["magic", tr("magic_link")],
                  ["key", tr("auth_tab_key")],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={clsx(
                    "flex-1 rounded-lg px-2 py-2 text-[11px] transition",
                    tab === id
                      ? "bg-cyan-500/20 text-nabi-neon"
                      : "text-nabi-muted hover:text-nabi-ink"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <input
              className="nabi-input"
              type="email"
              placeholder={tr("email_placeholder")}
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              autoComplete="email"
            />

            {tab === "password" ? (
              <>
                <input
                  className="nabi-input"
                  type="password"
                  placeholder={tr("password_placeholder")}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onPasswordAuth(false)}
                    disabled={loading}
                    className="nabi-btn-primary"
                  >
                    {loading ? tr("checking") : tr("login")}
                  </button>
                  <button
                    type="button"
                    onClick={() => onPasswordAuth(true)}
                    disabled={loading}
                    className="nabi-btn-ghost"
                  >
                    {tr("register")}
                  </button>
                </div>
                <button
                  type="button"
                  className="text-[11px] text-nabi-neon underline"
                  onClick={() => openAuth("reset")}
                >
                  {tr("forgot_password")}?
                </button>
                <p className="text-[10px] text-nabi-muted">{tr("auth_local_hint")}</p>
              </>
            ) : tab === "magic" ? (
              <>
                <p className="flex items-start gap-2 text-[11px] text-nabi-muted">
                  <Sparkles size={14} className="mt-0.5 shrink-0 text-nabi-neon" />
                  {tr("magic_link_hint")}
                </p>
                <button
                  type="button"
                  onClick={onMagic}
                  disabled={loading || !formEmail}
                  className="nabi-btn-primary w-full"
                >
                  {loading ? tr("checking") : tr("send_magic_link")}
                </button>
              </>
            ) : (
              <>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-nabi-muted">
                  <KeyRound size={16} /> {tr("profile_restore_title")}
                </h3>
                <input
                  className="nabi-input"
                  type="text"
                  placeholder={tr("key_placeholder")}
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value)}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={onKeyRestore}
                  disabled={loading}
                  className="nabi-btn-primary w-full"
                >
                  {loading ? tr("checking") : tr("login_with_key")}
                </button>
              </>
            )}
          </div>
        </>
      )}

      {(msg || err) && (
        <p
          className={clsx(
            "text-xs",
            err ? "text-red-400" : "text-nabi-neon"
          )}
        >
          {err || msg}
        </p>
      )}

    </div>
  );
}
