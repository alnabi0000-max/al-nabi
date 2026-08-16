"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, Loader2, Shield } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { fetchWithTimeout } from "@/lib/api/fetch-timeout";
import { MIN_PASSCODE_LENGTH } from "@/lib/admin/passcode-policy";
import { PasscodeField } from "@/components/admin/PasscodeField";

export function AdminSecuritySettings() {
  const { t } = useLanguage();
  const [currentPasscode, setCurrentPasscode] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (newPasscode.length < MIN_PASSCODE_LENGTH) {
      setError(t.admin.passcodeTooShort);
      return;
    }
    if (newPasscode !== confirmPasscode) {
      setError(t.admin.passcodeMismatch);
      return;
    }

    setBusy(true);
    try {
      const res = await fetchWithTimeout(
        "/api/admin/passcode",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentPasscode,
            newPasscode,
            confirmPasscode,
          }),
        },
        20_000
      );
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) {
        setError(
          res.status === 401
            ? t.admin.gateInvalid
            : json.error || t.admin.loadError
        );
        return;
      }
      setCurrentPasscode("");
      setNewPasscode("");
      setConfirmPasscode("");
      setSaved(true);
    } catch {
      setError(t.admin.loadError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-nabi-muted">
          <Shield size={12} />
          {t.admin.settingsEyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-nabi-ink">
          {t.admin.settingsTitle}
        </h1>
        <p className="mt-1 max-w-xl text-sm text-nabi-muted">
          {t.admin.settingsSubtitle}
        </p>
      </header>

      <section className="max-w-lg rounded-2xl border border-nabi-border bg-nabi-card p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-nabi-ink">
          <KeyRound size={16} />
          {t.admin.passcodeSection}
        </h2>
        <p className="mt-1 text-xs text-nabi-muted">{t.admin.passcodeHint}</p>
        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs text-nabi-muted">
              {t.admin.currentPasscode}
            </span>
            <PasscodeField
              value={currentPasscode}
              onChange={setCurrentPasscode}
              autoComplete="current-password"
              showLabel={t.admin.showPasscode}
              hideLabel={t.admin.hidePasscode}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-nabi-muted">{t.admin.newPasscode}</span>
            <PasscodeField
              value={newPasscode}
              onChange={setNewPasscode}
              autoComplete="new-password"
              showLabel={t.admin.showPasscode}
              hideLabel={t.admin.hidePasscode}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-nabi-muted">
              {t.admin.confirmPasscode}
            </span>
            <PasscodeField
              value={confirmPasscode}
              onChange={setConfirmPasscode}
              autoComplete="new-password"
              showLabel={t.admin.showPasscode}
              hideLabel={t.admin.hidePasscode}
            />
          </label>
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          {saved ? (
            <p className="text-sm text-emerald-400">{t.admin.passcodeSaved}</p>
          ) : null}
          <button
            type="submit"
            disabled={busy || !currentPasscode || !newPasscode || !confirmPasscode}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-nabi-bg disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            {t.common.save}
          </button>
        </form>
      </section>
    </div>
  );
}
