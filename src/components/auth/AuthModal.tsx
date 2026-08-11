"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { X, Mail, KeyRound, Sparkles } from "lucide-react";
import { useAuthUi } from "@/context/AuthUiContext";
import { useMaster } from "@/context/MasterControllerContext";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { fetchWithTimeout } from "@/lib/api/fetch-timeout";
import clsx from "clsx";

const SocialAuthButtons = dynamic(
  () =>
    import("@/components/auth/SocialAuthButtons").then((m) => ({
      default: m.SocialAuthButtons,
    })),
  { ssr: false }
);

type Tab = "login" | "magic" | "reset";

/**
 * In-app auth: Social + password + Magic Link + password recovery.
 */
export function AuthModal() {
  const { open, closeAuth, initialTab } = useAuthUi();
  const { tr, signInWithPassword, notify } = useMaster();
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setMsg(null);
      setErr(null);
    }
  }, [open, initialTab]);

  useDialogFocus(panelRef, open, closeAuth);

  if (!open) return null;

  async function onLogin(register: boolean) {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await signInWithPassword(email, password, register);
      if (res.ok) {
        setMsg(res.message);
        notify({ message: res.message, type: "success" });
        window.setTimeout(() => closeAuth(), 600);
      } else {
        setErr(res.message);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function onMagic() {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetchWithTimeout(
        "/api/auth/magic-link",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, next: "/dashboard" }),
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

  async function onReset() {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetchWithTimeout(
        "/api/auth/reset-password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
        20_000
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tr("auth_error"));
      setMsg(tr("reset_link_sent"));
      notify({ message: tr("reset_link_sent"), type: "success" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : tr("auth_error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAuth();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={tr("auth_modal_title")}
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl border border-nabi-border bg-[#121418] p-5 shadow-2xl outline-none"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-nabi-neon">
              Al-Nabi
            </p>
            <h2 className="text-lg font-bold">{tr("auth_modal_title")}</h2>
            <p className="text-xs text-nabi-muted">{tr("auth_modal_subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={closeAuth}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white"
            aria-label={tr("close")}
          >
            <X size={18} />
          </button>
        </div>

        <SocialAuthButtons className="mb-4" />

        <div className="relative mb-4 text-center text-[10px] uppercase tracking-widest text-zinc-400">
          <span className="relative z-10 bg-[#121418] px-2">{tr("auth_or")}</span>
          <div className="absolute inset-x-0 top-1/2 h-px bg-nabi-border" />
        </div>

        <div className="mb-3 flex gap-1 rounded-xl bg-black/30 p-1">
          {(
            [
              ["login", tr("login"), KeyRound],
              ["magic", tr("magic_link"), Sparkles],
              ["reset", tr("forgot_password"), Mail],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={clsx(
                "flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] transition",
                tab === id
                  ? "bg-cyan-500/20 text-nabi-neon"
                  : "text-zinc-500 hover:text-white"
              )}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <label htmlFor="auth-modal-email" className="sr-only">
            {tr("email_placeholder")}
          </label>
          <input
            id="auth-modal-email"
            className="nabi-input"
            type="email"
            placeholder={tr("email_placeholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          {tab === "login" && (
            <>
              <label htmlFor="auth-modal-password" className="sr-only">
                {tr("password_placeholder")}
              </label>
              <input
                id="auth-modal-password"
                className="nabi-input"
                type="password"
                placeholder={tr("password_placeholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => onLogin(false)}
                  className="nabi-btn-primary"
                >
                  {loading ? tr("checking") : tr("login")}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => onLogin(true)}
                  className="nabi-btn-ghost"
                >
                  {tr("register")}
                </button>
              </div>
              <button
                type="button"
                className="text-[11px] text-nabi-neon underline"
                onClick={() => setTab("reset")}
              >
                {tr("forgot_password")}?
              </button>
            </>
          )}

          {tab === "magic" && (
            <>
              <p className="text-[11px] text-zinc-500">{tr("magic_link_hint")}</p>
              <button
                type="button"
                disabled={loading || !email}
                onClick={onMagic}
                className="nabi-btn-primary w-full"
              >
                {loading ? tr("checking") : tr("send_magic_link")}
              </button>
            </>
          )}

          {tab === "reset" && (
            <>
              <p className="text-[11px] text-zinc-500">{tr("reset_hint")}</p>
              <button
                type="button"
                disabled={loading || !email}
                onClick={onReset}
                className="nabi-btn-primary w-full"
              >
                {loading ? tr("checking") : tr("send_reset_link")}
              </button>
            </>
          )}

          {(msg || err) && (
            <p className={clsx("text-xs", err ? "text-rose-400" : "text-nabi-neon")}>
              {err || msg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
