"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useMaster } from "@/context/MasterControllerContext";
import type { AuthTab } from "@/context/AuthUiContext";
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

export type AuthView = "signin" | "signup" | "code" | "reset";

type CodeStage = "email" | "code";

function tabToView(tab: AuthTab | AuthView): AuthView {
  if (tab === "signup" || tab === "code" || tab === "reset") return tab;
  return "signin";
}

type Props = {
  variant?: "page" | "modal";
  initialTab?: AuthTab | AuthView;
  onAuthenticated?: () => void;
  className?: string;
};

/**
 * World-standard auth: social (if enabled), email + password, one primary
 * action. Magic link / OTP stay as secondary screens, not competing buttons.
 */
export function AuthPanel({
  variant = "page",
  initialTab = "signin",
  onAuthenticated,
  className,
}: Props) {
  const { tr, signInWithPassword, refreshSession, notify } = useMaster();

  const [view, setView] = useState<AuthView>(() => tabToView(initialTab));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [codeStage, setCodeStage] = useState<CodeStage>("email");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<null | string>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const emailRef = useRef<HTMLInputElement>(null);

  const resetFeedback = useCallback(() => {
    setMsg(null);
    setErr(null);
  }, []);

  useEffect(() => {
    setView(tabToView(initialTab));
    setCodeStage("email");
    setCode("");
    setPending(null);
    resetFeedback();
  }, [initialTab, resetFeedback]);

  useEffect(() => {
    const id = window.setTimeout(() => emailRef.current?.focus(), 40);
    return () => window.clearTimeout(id);
  }, [view]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(
      () => setCooldown((s) => Math.max(0, s - 1)),
      1000
    );
    return () => window.clearInterval(id);
  }, [cooldown]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const passwordOk = password.length >= 6;
  const busy = pending !== null;

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

  const finishAuth = useCallback(() => {
    onAuthenticated?.();
  }, [onAuthenticated]);

  const onPasswordSubmit = (register: boolean) =>
    run(register ? "register" : "login", async () => {
      const res = await signInWithPassword(email.trim(), password, register);
      if (!res.ok) throw new Error(res.message);
      setMsg(res.message);
      notify({ message: res.message, type: "success" });
      if (res.message === tr("auth_confirm_email")) return;
      finishAuth();
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
        finishAuth();
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run/post are stable for this panel's lifecycle
    [email, post, refreshSession, notify, tr, finishAuth]
  );

  const onReset = () =>
    run("reset", async () => {
      await post("/api/auth/reset-password", { email: email.trim() });
      setMsg(tr("reset_link_sent"));
      notify({ message: tr("reset_link_sent"), type: "success" });
    });

  const isSignup = view === "signup";
  const title =
    view === "reset"
      ? tr("reset_password_title")
      : view === "code"
        ? tr("auth_tab_code")
        : isSignup
          ? tr("auth_create_title")
          : tr("auth_welcome_back");
  const subtitle =
    view === "reset"
      ? tr("reset_hint")
      : view === "code"
        ? tr("otp_hint")
        : isSignup
          ? tr("auth_create_subtitle")
          : tr("auth_signin_subtitle");

  return (
    <div className={clsx("w-full", variant === "modal" && "pr-6", className)}>
      <div className="mb-6 space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-nabi-neon">
          Al-Nabi
        </p>
        <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">
          {title}
        </h2>
        <p className="text-sm text-nabi-muted">{subtitle}</p>
      </div>

      {(view === "reset" || view === "code") && (
        <button
          type="button"
          onClick={() => {
            setView("signin");
            setCodeStage("email");
            resetFeedback();
          }}
          className="mb-5 inline-flex items-center gap-1.5 text-[11px] text-nabi-muted transition hover:text-nabi-ink"
        >
          <ArrowLeft size={13} />
          {tr("auth_back")}
        </button>
      )}

      <div className="space-y-4">
        {(view === "signin" || view === "signup") && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy && emailValid && passwordOk) onPasswordSubmit(isSignup);
            }}
          >
            <div className="space-y-4 [&:not(:has(button))]:hidden">
              <SocialAuthButtons next="/" compact />
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-nabi-muted">
                <span className="h-px flex-1 bg-nabi-border" />
                {tr("auth_or")}
                <span className="h-px flex-1 bg-nabi-border" />
              </div>
            </div>

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

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="auth-password"
                  className="text-[11px] font-medium text-nabi-muted"
                >
                  {tr("password_placeholder")}
                </label>
                {view === "signin" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setView("reset");
                      resetFeedback();
                    }}
                    className="text-[11px] text-nabi-muted transition hover:text-nabi-ink"
                  >
                    {tr("forgot_password")}?
                  </button>
                ) : null}
              </div>
              <input
                id="auth-password"
                className="nabi-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignup ? "new-password" : "current-password"}
                minLength={6}
                disabled={busy}
              />
            </div>

            <button
              type="submit"
              disabled={busy || !emailValid || !passwordOk}
              className="nabi-btn-primary flex w-full items-center justify-center gap-2"
            >
              {pending === "login" || pending === "register" ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  {tr("checking")}
                </>
              ) : isSignup ? (
                tr("register")
              ) : (
                tr("login")
              )}
            </button>

            <p className="text-center text-sm text-nabi-muted">
              {isSignup ? tr("auth_have_account") : tr("auth_no_account")}{" "}
              <button
                type="button"
                onClick={() => {
                  setView(isSignup ? "signin" : "signup");
                  resetFeedback();
                }}
                className="font-semibold text-nabi-ink transition hover:underline"
              >
                {isSignup ? tr("login") : tr("register")}
              </button>
            </p>
          </form>
        )}

        {(view === "reset" || (view === "code" && codeStage === "email")) && (
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

        {view === "code" && codeStage === "email" && (
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

        {view === "code" && codeStage === "code" && (
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

        {view === "reset" && (
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
          {tr("auth_privacy_note")}{" "}
          <Link href="/terms" className="text-nabi-ink/80 underline underline-offset-2">
            {tr("terms")}
          </Link>
          {" · "}
          <Link href="/privacy" className="text-nabi-ink/80 underline underline-offset-2">
            {tr("privacy")}
          </Link>
        </p>
      </div>
    </div>
  );
}
