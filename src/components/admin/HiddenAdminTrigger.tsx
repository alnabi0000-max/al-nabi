"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, X } from "lucide-react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useLanguage } from "@/context/LanguageContext";
import { fetchWithTimeout } from "@/lib/api/fetch-timeout";

function isAdminHotkey(e: KeyboardEvent): boolean {
  if (e.repeat) return false;
  if (e.code !== "KeyA") return false;
  if (!e.altKey) return false;
  return e.ctrlKey || e.metaKey;
}

/**
 * Global Ctrl+Alt+A (Cmd+Option+A) listener. No visible chrome until the
 * combination is pressed.
 */
export function HiddenAdminTrigger() {
  const router = useRouter();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    if (busy) return;
    setOpen(false);
    setPasscode("");
    setError(null);
  }, [busy]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isAdminHotkey(e)) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(true);
      setError(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  useDialogFocus(panelRef, open, close);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!passcode.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetchWithTimeout(
        "/api/admin/unlock",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passcode }),
        },
        20_000
      );
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (res.status === 429) {
        setError(t.admin.gateRateLimited);
        return;
      }
      if (!res.ok || json.ok === false) {
        setError(t.admin.gateInvalid);
        return;
      }
      setOpen(false);
      setPasscode("");
      router.push("/admin");
    } catch {
      setError(t.admin.gateInvalid);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/80 p-4 backdrop-blur-md sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-gate-title"
        tabIndex={-1}
        className="nabi-glass relative w-full max-w-md overflow-hidden rounded-3xl p-6 shadow-neon outline-none backdrop-blur-2xl"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-cinema-glow opacity-40 blur-3xl"
        />
        <button
          type="button"
          onClick={close}
          className="absolute right-4 top-4 rounded-full p-1.5 text-nabi-muted transition hover:bg-nabi-elevated hover:text-nabi-ink"
          aria-label={t.common.close}
        >
          <X size={16} />
        </button>
        <div className="relative">
          <p className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-nabi-muted">
            <KeyRound size={12} />
            {t.admin.gateEyebrow}
          </p>
          <h2
            id="admin-gate-title"
            className="text-xl font-semibold tracking-tight text-nabi-ink"
          >
            {t.admin.gateTitle}
          </h2>
          <p className="mt-1 text-sm text-nabi-muted">{t.admin.gateSubtitle}</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="sr-only">{t.admin.gateTitle}</span>
              <input
                ref={inputRef}
                type="password"
                autoComplete="off"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder={t.admin.gatePlaceholder}
                className="w-full rounded-2xl border border-nabi-border bg-nabi-input px-4 py-3 text-sm text-nabi-ink outline-none ring-nabi-neon/40 placeholder:text-nabi-muted focus:ring-2"
              />
            </label>
            {error ? <p className="text-sm text-rose-400">{error}</p> : null}
            <button
              type="submit"
              disabled={busy || !passcode.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-nabi-bg transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <KeyRound size={16} />
              )}
              {busy ? t.admin.gateBusy : t.admin.gateSubmit}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
