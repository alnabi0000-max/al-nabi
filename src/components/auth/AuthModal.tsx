"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useAuthUi, type AuthTab } from "@/context/AuthUiContext";
import { useMaster } from "@/context/MasterControllerContext";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { fetchWithTimeout } from "@/lib/api/fetch-timeout";
import { OtpCodeInput } from "@/components/auth/OtpCodeInput";
import clsx from "clsx";

const SocialAuthButtons = dynamic(
  () =>
    import("@/components/auth/SocialAuthButtons").then((m) => ({
      default: m.SocialAuthButtons,
    })),
  { ssr: false }
);

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SEC = 45;

type CodeStage = "email" | "code";

/**
 * Al-Nabi auth: one-click social, magic link, and a passwordless 6-digit email
 * code. Password sign-in stays available behind the quick tab for existing
 * accounts.
 */
export function AuthModal() {
  const { open, closeAuth, initialTab } = useAuthUi();
  const { tr, signInWithPassword, refreshSession, notify } = useMaster();

  const [tab, setTab] = useState<AuthTab>("quick");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [codeStage, setCodeStage] = useState<CodeStage>("email");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<null | string>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const panelRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const resetFeedback = useCallback(() => {
    setMsg(null);
    setErr(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setCodeStage("email");
    setCode("");
    setShowPassword(false);
    setPending(null);
    resetFeedback();
  }, [open, initialTab, resetFeedback]);

  useDialogFocus(panelRef, open, closeAuth);

  // Runs after useDialogFocus so the email field wins over the close button.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => emailRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [open, tab]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(
      () => setCooldown((s) => Math.max(0, s - 1)),
      1000
    );
    return () => window.clearInterval(id);
  }, [cooldown]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  const post = useCallback(
    async (url: string, body: Record<string, unknown>) => {
      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        20_000
      );
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok || data.ok === false) {
        throw new Error((data.error as string) || tr("auth_error"));
      }
      return data;
    },
    [tr]
  );

  async function run(key: string, fn: () => Promise<void>) {
    setPending(key);
    resetFeedback();
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : tr("auth_error"));
    } finally {
      setPending(null);
    }
  }

  const onPasswordLogin = (register: boolean) =>
    run(register ? "register" : "login", async () => {
      const res = await signInWithPassword(email.trim(), password, register);
      if (!res.ok) throw new Error(res.message);
      setMsg(res.message);
      notify({ message: res.message, type: "success" });
      window.setTimeout(() => closeAuth(), 600);
    });

  const onMagicLink = () =>
    run("magic", async () => {
      await post("/api/auth/magic-link", {
        email: email.trim(),
        next: "/profile?tab=kabinet",
      });
      setMsg(tr("magic_link_sent"));
      notify({ message: tr("magic_link_sent"), type: "success" });
    });

  const onSendCode = () =>
    run("send-code", async () => {
      await post("/api/auth/otp/send", { email: email.trim() });
      setCodeStage("code");
      setCode("");
      setCooldown(RESEND_COOLDOWN_SEC);
      setMsg(tr("otp_sent", { email: email.trim() }));
    });

  const onVerifyCode = useCallback(
    (value: string) =>
      run("verify-code", async () => {
        await post("/api/auth/otp/verify", {
          email: email.trim(),
          token: value,
          platform: "web",
        });
        await refreshSession();
        notify({ message: tr("otp_verified"), type: "success" });
        closeAuth();
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run/post are stable for this dialog's lifecycle
    [email, post, refreshSession, notify, tr, closeAuth]
  );

  const onReset = () =>
    run("reset", async () => {
      await post("/api/auth/reset-password", { email: email.trim() });
      setMsg(tr("reset_link_sent"));
      notify({ message: tr("reset_link_sent"), type: "success" });
    });

  if (!open) return null;

  const busy = pending !== null;

  return (
    <div
      className="glass-scrim fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center"
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
        className="glass-modal relative w-full max-w-md overflow-hidden p-6 outline-none"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-cinema-glow opacity-40 blur-3xl"
        />

        <div className="relative mb-5 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-nabi-neon">
              Al-Nabi
            </p>
            <h2 className="text-xl font-bold leading-tight">
              {tr("auth_modal_title")}
            </h2>
            <p className="text-xs text-nabi-muted">
              {tr("auth_modal_subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={closeAuth}
            className="rounded-xl p-2 text-nabi-muted transition hover:bg-white/5 hover:text-nabi-ink"
            aria-label={tr("close")}
          >
            <X size={18} />
          </button>
        </div>

        {tab === "reset" ? (
          <button
            type="button"
            onClick={() => {
              setTab("quick");
              resetFeedback();
            }}
            className="relative mb-4 inline-flex items-center gap-1.5 text-[11px] text-nabi-muted transition hover:text-nabi-ink"
          >
            <ArrowLeft size={13} />
            {tr("auth_back")}
          </button>
        ) : (
          <div
            role="tablist"
            aria-label={tr("auth_modal_title")}
            className="glass-card relative mb-5 grid grid-cols-2 gap-1 rounded-2xl p-1"
          >
            {(
              [
                ["quick", tr("auth_tab_quick"), Sparkles],
                ["code", tr("auth_tab_code"), ShieldCheck],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={tab === id}
                onClick={() => {
                  setTab(id);
                  resetFeedback();
                }}
                className={clsx(
                  "nabi-select px-3 py-2.5 text-xs",
                  tab === id && "nabi-select-on"
                )}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="relative space-y-4">
          {tab === "quick" && (
            <>
              <SocialAuthButtons />
              <div className="relative text-center text-[10px] uppercase tracking-[0.2em] text-nabi-muted">
                <span className="relative z-10 bg-[#080b14]/70 px-3">
                  {tr("auth_or")}
                </span>
                <div className="absolute inset-x-0 top-1/2 h-px bg-nabi-border" />
              </div>
            </>
          )}

          {(tab !== "code" || codeStage === "email") && (
            <div className="space-y-1.5">
              <label
                htmlFor="auth-email"
                className="text-[11px] font-medium text-nabi-muted"
              >
                {tr("email_placeholder")}
              </label>
              <input
                ref={emailRef}
                id="auth-email"
                className="nabi-input"
                type="email"
                inputMode="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  resetFeedback();
                }}
                autoComplete="email"
                disabled={busy}
              />
            </div>
          )}

          {tab === "quick" && (
            <>
              <button
                type="button"
                disabled={busy || !emailValid}
                onClick={onMagicLink}
                className="nabi-btn-primary flex w-full items-center justify-center gap-2"
              >
                {pending === "magic" ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    {tr("checking")}
                  </>
                ) : (
                  <>
                    <Mail size={15} />
                    {tr("send_magic_link")}
                  </>
                )}
              </button>
              <p className="text-[11px] leading-relaxed text-nabi-muted">
                {tr("magic_link_hint")}
              </p>

              {showPassword ? (
                <div className="glass-card space-y-3 rounded-2xl p-3">
                  <label htmlFor="auth-password" className="sr-only">
                    {tr("password_placeholder")}
                  </label>
                  <input
                    id="auth-password"
                    className="nabi-input"
                    type="password"
                    placeholder={tr("password_placeholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={busy}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={busy || !emailValid || password.length < 6}
                      onClick={() => onPasswordLogin(false)}
                      className="nabi-btn-primary"
                    >
                      {pending === "login" ? tr("checking") : tr("login")}
                    </button>
                    <button
                      type="button"
                      disabled={busy || !emailValid || password.length < 6}
                      onClick={() => onPasswordLogin(true)}
                      className="nabi-btn-ghost"
                    >
                      {pending === "register" ? tr("checking") : tr("register")}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTab("reset");
                      resetFeedback();
                    }}
                    className="text-[11px] text-nabi-neon underline underline-offset-2"
                  >
                    {tr("forgot_password")}?
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowPassword(true)}
                  className="inline-flex items-center gap-1.5 text-[11px] text-nabi-muted transition hover:text-nabi-ink"
                >
                  <KeyRound size={12} />
                  {tr("auth_use_password")}
                </button>
              )}
            </>
          )}

          {tab === "code" && codeStage === "email" && (
            <>
              <button
                type="button"
                disabled={busy || !emailValid}
                onClick={onSendCode}
                className="nabi-btn-primary flex w-full items-center justify-center gap-2"
              >
                {pending === "send-code" ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    {tr("checking")}
                  </>
                ) : (
                  <>
                    <ShieldCheck size={15} />
                    {tr("otp_send")}
                  </>
                )}
              </button>
              <p className="text-[11px] leading-relaxed text-nabi-muted">
                {tr("otp_hint")}
              </p>
            </>
          )}

          {tab === "code" && codeStage === "code" && (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-nabi-muted">
                  {tr("otp_enter_for", { email: email.trim() })}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCodeStage("email");
                    setCode("");
                    resetFeedback();
                  }}
                  className="shrink-0 text-[11px] text-nabi-neon underline underline-offset-2"
                >
                  {tr("auth_change_email")}
                </button>
              </div>

              <OtpCodeInput
                length={OTP_LENGTH}
                value={code}
                disabled={busy}
                onChange={(next) => {
                  setCode(next);
                  if (err) setErr(null);
                }}
                onComplete={onVerifyCode}
                label={tr("otp_input_label")}
              />

              <button
                type="button"
                disabled={busy || code.length !== OTP_LENGTH}
                onClick={() => onVerifyCode(code)}
                className="nabi-btn-primary flex w-full items-center justify-center gap-2"
              >
                {pending === "verify-code" ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    {tr("checking")}
                  </>
                ) : (
                  tr("otp_verify")
                )}
              </button>

              <button
                type="button"
                disabled={busy || cooldown > 0}
                onClick={onSendCode}
                className="w-full text-[11px] text-nabi-muted transition enabled:hover:text-nabi-ink disabled:opacity-60"
              >
                {cooldown > 0
                  ? tr("otp_resend_in", { seconds: cooldown })
                  : tr("otp_resend")}
              </button>
            </>
          )}

          {tab === "reset" && (
            <>
              <button
                type="button"
                disabled={busy || !emailValid}
                onClick={onReset}
                className="nabi-btn-primary flex w-full items-center justify-center gap-2"
              >
                {pending === "reset" ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    {tr("checking")}
                  </>
                ) : (
                  tr("send_reset_link")
                )}
              </button>
              <p className="text-[11px] leading-relaxed text-nabi-muted">
                {tr("reset_hint")}
              </p>
            </>
          )}

          <div aria-live="polite" className="min-h-[16px]">
            {(msg || err) && (
              <p
                className={clsx(
                  "text-xs leading-relaxed",
                  err ? "text-rose-400" : "text-nabi-neon"
                )}
              >
                {err || msg}
              </p>
            )}
          </div>

          <p className="border-t border-nabi-border pt-3 text-[10px] leading-relaxed text-nabi-muted">
            {tr("auth_privacy_note")}
          </p>
        </div>
      </div>
    </div>
  );
}
