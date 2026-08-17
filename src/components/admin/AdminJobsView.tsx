"use client";

import { useCallback, useEffect, useState } from "react";
import type { GenerationStatus } from "@prisma/client";
import { Clapperboard, Loader2, RefreshCw, Search } from "lucide-react";
import clsx from "clsx";
import { useLanguage } from "@/context/LanguageContext";
import { fetchWithTimeout } from "@/lib/api/fetch-timeout";
import type { AdminJobsPayload } from "@/lib/admin/ops";
import {
  formatAdminWhen,
  formatNc,
} from "@/components/admin/admin-format";

const JOB_STATUSES: Array<GenerationStatus | "ALL"> = [
  "ALL",
  "QUEUED",
  "ANALYZING",
  "GENERATING_AUDIO",
  "GENERATING_VIDEO",
  "MERGING",
  "COMPLETED",
  "FAILED",
];

export function AdminJobsView({
  initial,
}: {
  initial?: AdminJobsPayload | null;
}) {
  const { t, locale } = useLanguage();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<GenerationStatus | "ALL">("ALL");
  const [page, setPage] = useState(initial?.page ?? 1);
  const [data, setData] = useState<AdminJobsPayload | null>(initial ?? null);
  const [busy, setBusy] = useState(!initial);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (
      nextQ: string,
      nextStatus: GenerationStatus | "ALL",
      nextPage: number
    ) => {
      setBusy(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          status: nextStatus,
        });
        if (nextQ.trim()) params.set("q", nextQ.trim());
        const res = await fetchWithTimeout(
          `/api/admin/jobs?${params.toString()}`,
          { credentials: "include", cache: "no-store" },
          20_000
        );
        const json = (await res.json()) as AdminJobsPayload & {
          error?: string;
        };
        if (!res.ok) throw new Error(json.error || t.admin.loadError);
        setData(json);
        setPage(json.page);
      } catch (e) {
        setError(e instanceof Error ? e.message : t.admin.loadError);
      } finally {
        setBusy(false);
      }
    },
    [t]
  );

  useEffect(() => {
    if (initial && page === initial.page && !q && status === "ALL") return;
    const handle = window.setTimeout(() => {
      void load(q, status, page);
    }, q ? 300 : 0);
    return () => window.clearTimeout(handle);
  }, [q, status, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const pages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-nabi-muted">
            <Clapperboard size={12} />
            {t.admin.jobsEyebrow}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-nabi-ink">
            {t.admin.jobsTitle}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-nabi-muted">
            {t.admin.jobsSubtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(q, status, page)}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full border border-nabi-border px-4 py-2 text-sm text-nabi-ink hover:bg-nabi-elevated disabled:opacity-60"
        >
          {busy ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          {t.common.refresh}
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {JOB_STATUSES.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setStatus(key);
              setPage(1);
            }}
            className={clsx(
              "rounded-full px-3.5 py-1.5 text-sm transition",
              status === key
                ? "bg-white text-nabi-bg"
                : "border border-nabi-border text-nabi-muted hover:bg-nabi-elevated hover:text-nabi-ink"
            )}
          >
            {key === "ALL" ? t.admin.filterAll : key}
          </button>
        ))}
      </div>

      <form
        className="relative max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          void load(q, status, 1);
        }}
      >
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-nabi-muted"
        />
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder={t.admin.jobsSearch}
          className="w-full rounded-xl border border-nabi-border bg-nabi-input py-2.5 pl-9 pr-3 text-sm text-nabi-ink outline-none focus:border-nabi-gold/40"
        />
      </form>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      <section className="overflow-hidden rounded-2xl border border-nabi-border bg-nabi-card">
        {data?.jobs.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-nabi-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">{t.admin.colTime}</th>
                  <th className="px-4 py-2 font-medium">{t.admin.colUser}</th>
                  <th className="px-4 py-2 font-medium">{t.admin.colJobType}</th>
                  <th className="px-4 py-2 font-medium">{t.admin.colStatus}</th>
                  <th className="px-4 py-2 font-medium">{t.admin.colCost}</th>
                  <th className="px-4 py-2 font-medium">{t.admin.colError}</th>
                </tr>
              </thead>
              <tbody>
                {data.jobs.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-nabi-border/80 text-nabi-ink"
                  >
                    <td className="px-4 py-2.5 tabular-nums text-nabi-muted">
                      {formatAdminWhen(row.createdAt, locale)}
                    </td>
                    <td className="px-4 py-2.5">{row.email}</td>
                    <td className="px-4 py-2.5">{row.type}</td>
                    <td
                      className={clsx(
                        "px-4 py-2.5",
                        row.status === "FAILED"
                          ? "text-rose-300"
                          : row.status === "COMPLETED"
                            ? "text-emerald-300"
                            : "text-nabi-ink"
                      )}
                    >
                      {row.status}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {formatNc(row.creditsCost)}
                    </td>
                    <td className="max-w-[280px] truncate px-4 py-2.5 text-nabi-muted">
                      {row.errorMessage || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-nabi-muted">
            {busy ? t.common.loading : t.admin.emptyJobs}
          </p>
        )}
      </section>

      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-between text-sm text-nabi-muted">
          <p>
            {data.total} · {page}/{pages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || busy}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-full border border-nabi-border px-3 py-1.5 disabled:opacity-50"
            >
              {t.admin.prevPage}
            </button>
            <button
              type="button"
              disabled={page >= pages || busy}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-full border border-nabi-border px-3 py-1.5 disabled:opacity-50"
            >
              {t.admin.nextPage}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
