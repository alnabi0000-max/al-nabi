"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, RefreshCw, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { fetchWithTimeout } from "@/lib/api/fetch-timeout";

type Pending = {
  id: string;
  displayName: string;
  currentModelId: string;
  proposedModelId: string;
  proposedVersionLabel: string;
  messageUz: string;
  messageEn: string;
  detectedAt: string;
};

type Active = {
  slot: string;
  displayName: string;
  modelId: string;
};

type CoreHealth = {
  currency: string;
  engine: string;
  archiveFeeNc: number;
  openRouter: boolean;
  videoApi: boolean;
  telegram: boolean;
  cronSecret: boolean;
  objectStorage: boolean;
  ready: boolean;
};

const ADMIN_FETCH: RequestInit = {
  credentials: "include",
  cache: "no-store",
};

export default function AdminModelsPage() {
  const { t } = useLanguage();
  const [pending, setPending] = useState<Pending[]>([]);
  const [active, setActive] = useState<Active[]>([]);
  const [lastWatchAt, setLastWatchAt] = useState<string | null>(null);
  const [health, setHealth] = useState<CoreHealth | null>(null);
  const [busy, setBusy] = useState<string | null>("load");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy("load");
    setError(null);
    try {
      const [modelsRes, sysRes] = await Promise.all([
        fetchWithTimeout("/api/admin/models", ADMIN_FETCH, 15_000),
        fetchWithTimeout("/api/admin/system", ADMIN_FETCH, 15_000),
      ]);
      const data = (await modelsRes.json()) as {
        error?: string;
        pending?: Pending[];
        active?: Active[];
        lastWatchAt?: string | null;
      };
      if (!modelsRes.ok) throw new Error(data.error || t.admin.loadError);
      setPending(data.pending || []);
      setActive(data.active || []);
      setLastWatchAt(data.lastWatchAt || null);
      if (sysRes.ok) {
        const sys = (await sysRes.json()) as { health?: CoreHealth };
        setHealth(sys.health || null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.admin.loadError);
    } finally {
      setBusy(null);
    }
  }, [t]);

  useEffect(() => {
    void load();
    // Initial fetch only — `load` closes over locale strings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runWatch() {
    setBusy("watch");
    setError(null);
    try {
      const res = await fetchWithTimeout(
        "/api/admin/models",
        { ...ADMIN_FETCH, method: "POST" },
        30_000
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || t.admin.loadError);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.admin.loadError);
    } finally {
      setBusy(null);
    }
  }

  async function act(pendingId: string, action: "approve" | "dismiss") {
    setBusy(pendingId);
    setError(null);
    try {
      const res = await fetchWithTimeout(
        "/api/admin/models/approve",
        {
          ...ADMIN_FETCH,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pendingId, action }),
        },
        15_000
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || t.admin.actionError);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.admin.actionError);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.2em] text-nabi-muted">
            {t.admin.navModels}
          </p>
          <h1 className="text-2xl font-semibold text-nabi-ink">
            {t.admin.title}
          </h1>
          <p className="mt-1 text-sm text-nabi-muted">
            Last watch: {lastWatchAt ? new Date(lastWatchAt).toLocaleString() : "—"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runWatch()}
          disabled={busy === "watch" || busy === "load"}
          className="inline-flex items-center gap-2 rounded-full border border-nabi-border px-4 py-2 text-sm text-nabi-ink hover:bg-nabi-elevated disabled:opacity-60"
        >
          {busy === "watch" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          {t.admin.runWatch}
        </button>
      </header>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      {health && (
        <section className="rounded-2xl border border-nabi-border bg-nabi-card p-4">
          <h2 className="text-sm font-medium text-nabi-muted">{t.admin.coreSystem}</h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-2">
              <dt className="text-nabi-muted">{t.admin.currency}</dt>
              <dd className="text-nabi-ink">{health.currency}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-nabi-muted">{t.admin.engine}</dt>
              <dd className="text-nabi-ink">{health.engine}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-nabi-muted">{t.admin.vaultFee}</dt>
              <dd className="text-nabi-ink">{health.archiveFeeNc} NC</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-nabi-muted">{t.admin.status}</dt>
              <dd className={health.ready ? "text-emerald-400" : "text-amber-400"}>
                {health.ready ? t.admin.ready : t.admin.needsKeys}
              </dd>
            </div>
          </dl>
          <ul className="mt-3 flex flex-wrap gap-2 text-[11px]">
            {(
              [
                ["LLM", health.openRouter],
                ["Video API", health.videoApi],
                ["Telegram", health.telegram],
                ["Cron", health.cronSecret],
                ["Object storage", health.objectStorage],
              ] as const
            ).map(([label, ok]) => (
              <li
                key={label}
                className={
                  ok
                    ? "rounded-full border border-emerald-500/30 px-2 py-0.5 text-emerald-300"
                    : "rounded-full border border-nabi-border px-2 py-0.5 text-nabi-muted"
                }
              >
                {label}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-nabi-muted">
          {t.admin.pending} ({pending.length})
        </h2>
        {busy === "load" && pending.length === 0 && !error ? (
          <p className="rounded-xl border border-nabi-border bg-nabi-card px-4 py-8 text-center text-sm text-nabi-muted">
            {t.common.loading}
          </p>
        ) : null}
        {pending.length === 0 && busy !== "load" && !error && (
          <p className="rounded-xl border border-nabi-border bg-nabi-card px-4 py-8 text-center text-sm text-nabi-muted">
            Yangi model yangilanishi yo‘q / No pending model updates
          </p>
        )}
        {pending.map((p) => (
          <article
            key={p.id}
            className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4"
          >
            <p className="text-sm font-semibold text-nabi-ink">{p.displayName}</p>
            <p className="mt-2 text-sm text-nabi-ink">{p.messageUz}</p>
            <p className="mt-1 text-xs text-nabi-muted">{p.messageEn}</p>
            <p className="mt-3 font-mono text-[11px] text-nabi-muted">
              {p.currentModelId} → {p.proposedModelId} ({p.proposedVersionLabel})
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void act(p.id, "approve")}
                disabled={busy === p.id}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-nabi-bg"
              >
                {busy === p.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                {t.admin.approve}
              </button>
              <button
                type="button"
                onClick={() => void act(p.id, "dismiss")}
                disabled={busy === p.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-nabi-border px-3 py-2 text-sm text-nabi-ink"
              >
                <X size={14} />
                {t.admin.dismiss}
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-nabi-muted">{t.admin.activeEndpoints}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {active.map((a) => (
            <div
              key={a.slot}
              className="rounded-xl border border-nabi-border bg-nabi-card px-3 py-3"
            >
              <p className="text-sm font-medium text-nabi-ink">{a.displayName}</p>
              <p className="mt-1 truncate font-mono text-[11px] text-nabi-muted">
                {a.modelId}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
