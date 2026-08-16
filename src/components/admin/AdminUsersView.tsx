"use client";

import { useCallback, useEffect, useState } from "react";
import type { AccountStatus, UserRole } from "@prisma/client";
import { Loader2, RefreshCw, Search, Users } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { fetchWithTimeout } from "@/lib/api/fetch-timeout";
import type { AdminUserRow, AdminUsersPayload } from "@/lib/admin/ops";
import {
  formatAdminWhen,
  formatNc,
} from "@/components/admin/admin-format";

export function AdminUsersView({
  initial,
}: {
  initial?: AdminUsersPayload | null;
}) {
  const { t, locale } = useLanguage();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(initial?.page ?? 1);
  const [data, setData] = useState<AdminUsersPayload | null>(initial ?? null);
  const [busy, setBusy] = useState(!initial);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { delta: string; reason: string }>
  >({});

  const load = useCallback(
    async (nextQ: string, nextPage: number) => {
      setBusy(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(nextPage) });
        if (nextQ.trim()) params.set("q", nextQ.trim());
        const res = await fetchWithTimeout(
          `/api/admin/users?${params.toString()}`,
          { credentials: "include", cache: "no-store" },
          20_000
        );
        const json = (await res.json()) as AdminUsersPayload & {
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
    if (initial && page === initial.page && !q) return;
    const handle = window.setTimeout(() => {
      void load(q, page);
    }, q ? 300 : 0);
    return () => window.clearTimeout(handle);
  }, [q, page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function patch(
    userId: string,
    body: Record<string, unknown>
  ): Promise<boolean> {
    setRowBusy(userId);
    setError(null);
    setSaved(null);
    try {
      const res = await fetchWithTimeout(
        "/api/admin/users",
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        20_000
      );
      const json = (await res.json()) as {
        error?: string;
        user?: Pick<AdminUserRow, "id" | "role" | "status" | "coins">;
      };
      if (!res.ok) throw new Error(json.error || t.admin.actionError);
      if (json.user) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                users: prev.users.map((row) =>
                  row.id === json.user!.id
                    ? {
                        ...row,
                        role: json.user!.role,
                        status: json.user!.status,
                        coins: json.user!.coins,
                      }
                    : row
                ),
              }
            : prev
        );
      }
      setSaved(t.admin.actionSaved);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : t.admin.actionError);
      return false;
    } finally {
      setRowBusy(null);
    }
  }

  const pages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-nabi-muted">
            <Users size={12} />
            {t.admin.usersEyebrow}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-nabi-ink">
            {t.admin.usersTitle}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-nabi-muted">
            {t.admin.usersSubtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(q, page)}
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

      <form
        className="relative max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          void load(q, 1);
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
          placeholder={t.admin.usersSearch}
          className="w-full rounded-xl border border-nabi-border bg-nabi-input py-2.5 pl-9 pr-3 text-sm text-nabi-ink outline-none focus:border-nabi-neon/40"
        />
      </form>

      {error && <p className="text-sm text-rose-400">{error}</p>}
      {saved && <p className="text-sm text-emerald-400">{saved}</p>}

      <section className="overflow-hidden rounded-2xl border border-nabi-border bg-nabi-card">
        {data?.users.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-nabi-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">{t.admin.colUser}</th>
                  <th className="px-4 py-2 font-medium">{t.admin.colRole}</th>
                  <th className="px-4 py-2 font-medium">{t.admin.colStatus}</th>
                  <th className="px-4 py-2 font-medium">{t.admin.colNc}</th>
                  <th className="px-4 py-2 font-medium">{t.admin.colPlan}</th>
                  <th className="px-4 py-2 font-medium">{t.admin.colCreated}</th>
                  <th className="px-4 py-2 font-medium">{t.admin.colLastLogin}</th>
                  <th className="px-4 py-2 font-medium">{t.admin.adjustNc}</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((row) => {
                  const draft = drafts[row.id] ?? { delta: "", reason: "" };
                  const locked = rowBusy === row.id;
                  return (
                    <tr
                      key={row.id}
                      className="border-t border-nabi-border/80 align-top text-nabi-ink"
                    >
                      <td className="px-4 py-2.5">
                        <p>{row.email}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={row.role}
                          disabled={locked}
                          onChange={(e) =>
                            void patch(row.id, {
                              action: "role",
                              userId: row.id,
                              role: e.target.value as UserRole,
                            })
                          }
                          className="rounded-lg border border-nabi-border bg-nabi-input px-2 py-1 text-xs text-nabi-ink"
                        >
                          <option value="USER">{t.admin.roleUser}</option>
                          <option value="MODERATOR">
                            {t.admin.roleModerator}
                          </option>
                          <option value="ADMIN">{t.admin.roleAdmin}</option>
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={row.status}
                          disabled={locked}
                          onChange={(e) => {
                            const status = e.target.value as AccountStatus;
                            if (
                              status === "BANNED" &&
                              !window.confirm(t.admin.confirmBan)
                            ) {
                              return;
                            }
                            void patch(row.id, {
                              action: "status",
                              userId: row.id,
                              status,
                            });
                          }}
                          className="rounded-lg border border-nabi-border bg-nabi-input px-2 py-1 text-xs text-nabi-ink"
                        >
                          <option value="ACTIVE">{t.admin.statusActive}</option>
                          <option value="WARNING">
                            {t.admin.statusWarning}
                          </option>
                          <option value="BANNED">{t.admin.statusBanned}</option>
                        </select>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">
                        {formatNc(row.coins)}
                      </td>
                      <td className="px-4 py-2.5">{row.plan}</td>
                      <td className="px-4 py-2.5 tabular-nums text-nabi-muted">
                        {formatAdminWhen(row.createdAt, locale)}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-nabi-muted">
                        {row.lastLoginAt
                          ? formatAdminWhen(row.lastLoginAt, locale)
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex min-w-[220px] flex-col gap-1.5">
                          <input
                            type="number"
                            value={draft.delta}
                            disabled={locked}
                            placeholder={t.admin.adjustNcHint}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [row.id]: { ...draft, delta: e.target.value },
                              }))
                            }
                            className="rounded-lg border border-nabi-border bg-nabi-input px-2 py-1 text-xs text-nabi-ink"
                          />
                          <input
                            type="text"
                            value={draft.reason}
                            disabled={locked}
                            placeholder={t.admin.adjustNcReason}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [row.id]: { ...draft, reason: e.target.value },
                              }))
                            }
                            className="rounded-lg border border-nabi-border bg-nabi-input px-2 py-1 text-xs text-nabi-ink"
                          />
                          <button
                            type="button"
                            disabled={locked || !draft.delta}
                            onClick={() => {
                              const delta = Number(draft.delta);
                              if (!Number.isFinite(delta) || !delta) return;
                              void patch(row.id, {
                                action: "adjust_nc",
                                userId: row.id,
                                delta,
                                reason: draft.reason || undefined,
                              }).then((ok) => {
                                if (ok) {
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [row.id]: { delta: "", reason: "" },
                                  }));
                                }
                              });
                            }}
                            className="inline-flex items-center justify-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-nabi-bg disabled:opacity-50"
                          >
                            {locked ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : null}
                            {t.admin.applyAction}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-nabi-muted">
            {busy ? t.common.loading : t.admin.emptyUsers}
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
