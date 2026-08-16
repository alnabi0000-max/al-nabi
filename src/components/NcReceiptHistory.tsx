"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Receipt, Clapperboard, ImageIcon, Film, Archive } from "lucide-react";
import { useMaster } from "@/context/MasterControllerContext";
import { useIsMounted } from "@/hooks/useIsMounted";
import { formatCredits } from "@/lib/credits";
import {
  listNcReceipts,
  subscribeNcReceipts,
  totalNcSpent,
  type NcReceipt,
  type NcSpendKind,
} from "@/lib/nc-receipts";
import { fetchWithTimeout } from "@/lib/api/fetch-timeout";
import { profileHref } from "@/lib/profile-tabs";
import { ClientOnly } from "@/components/ClientOnly";
import clsx from "clsx";

function kindLabel(kind: NcSpendKind, tr: (k: string) => string): string {
  switch (kind) {
    case "image":
      return tr("mode_image");
    case "prompt_to_video":
      return tr("mode_video");
    case "text_to_movie":
      return tr("mode_script_film");
    case "vault":
      return tr("nc_receipts_kind_vault");
    default:
      return tr("nc_receipts_kind_other");
  }
}

function KindIcon({ kind }: { kind: NcSpendKind }) {
  const cls = "shrink-0 text-nabi-gold";
  if (kind === "image") return <ImageIcon size={14} className={cls} />;
  if (kind === "text_to_movie") return <Film size={14} className={cls} />;
  if (kind === "vault") return <Archive size={14} className={cls} />;
  return <Clapperboard size={14} className={cls} />;
}

function formatDuration(sec?: number): string | null {
  if (!sec || sec <= 0) return null;
  if (sec < 60) return `${sec}s`;
  const m = Math.round(sec / 60);
  return `${m} min`;
}

function formatWhen(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleString(locale, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * NC cheklar — nima yaratilgani va qancha NC yechilgani.
 * compact: studio kalkulyator osti. full: Kabinet ledger.
 */
export function NcReceiptHistory({
  className,
  variant = "compact",
  limit,
  showKabinetLink,
  syncRemote,
}: {
  className?: string;
  variant?: "compact" | "full";
  limit?: number;
  showKabinetLink?: boolean;
  syncRemote?: boolean;
}) {
  const compact = variant === "compact";
  const cap = limit ?? (compact ? 5 : 24);
  const linkToKabinet = showKabinetLink ?? compact;
  const pullRemote = syncRemote ?? !compact;
  const { tr, locale, alnabiyKey } = useMaster();
  const mounted = useIsMounted();
  const [items, setItems] = useState<NcReceipt[]>([]);

  const refreshLocal = useCallback(() => {
    setItems(listNcReceipts());
  }, []);

  useEffect(() => {
    if (!mounted) return;
    refreshLocal();
    return subscribeNcReceipts(refreshLocal);
  }, [mounted, refreshLocal]);

  useEffect(() => {
    if (!mounted || !pullRemote || !alnabiyKey) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchWithTimeout(
          "/api/assets",
          { headers: { "x-alnabiy-key": alnabiyKey } },
          12_000
        );
        const data = await res.json();
        if (!res.ok || !data.ok || cancelled) return;
        const assets = (data.assets || []) as Array<{
          id: string;
          kind: string;
          title: string;
          creditsCost: number;
          durationSec?: number;
          quality?: string | null;
          provider?: string | null;
          createdAt: string;
        }>;
        const { upsertNcReceipts } = await import("@/lib/nc-receipts");
        upsertNcReceipts(
          assets
            .filter((a) => a.creditsCost > 0)
            .map((a) => ({
              id: a.id,
              kind: (a.kind as NcSpendKind) || "other",
              title: a.title,
              creditsCost: a.creditsCost,
              durationSec: a.durationSec,
              quality: a.quality,
              provider: a.provider,
              createdAt: a.createdAt,
            }))
        );
        if (!cancelled) refreshLocal();
      } catch {
        /* local receipts still show */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted, pullRemote, alnabiyKey, refreshLocal]);

  const visible = useMemo(() => items.slice(0, cap), [items, cap]);
  const total = useMemo(() => totalNcSpent(items), [items]);

  return (
    <section
      id="nc-receipts"
      className={clsx(
        "glass-card rounded-xl border-amber-500/25",
        compact ? "p-3" : "p-4",
        className
      )}
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-nabi-gold">
            <Receipt size={13} />
            {tr("nc_receipts_title")}
          </p>
          {!compact && (
            <p className="mt-0.5 text-[11px] text-nabi-muted">
              {tr("nc_receipts_subtitle")}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-nabi-muted">
            {tr("nc_receipts_total")}
          </p>
          <p className="font-mono text-sm font-bold tabular-nums text-nabi-gold">
            <ClientOnly fallback="—">{formatCredits(total)}</ClientOnly>
          </p>
        </div>
      </div>

      <ClientOnly
        fallback={
          <p className="text-sm text-nabi-muted">{tr("loading")}</p>
        }
      >
        {visible.length === 0 ? (
          <p className="text-sm text-nabi-muted">{tr("nc_receipts_empty")}</p>
        ) : (
          <ul className="divide-y divide-amber-500/15 font-mono text-xs">
            {visible.map((row) => {
              const dur = formatDuration(row.durationSec);
              return (
                <li
                  key={row.id}
                  className={clsx(
                    "flex items-start justify-between gap-3 first:pt-0 last:pb-0",
                    compact ? "py-1.5" : "py-2.5"
                  )}
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-amber-200/80">
                      <KindIcon kind={row.kind} />
                      {kindLabel(row.kind, tr)}
                      {row.quality ? ` · ${row.quality}` : ""}
                      {dur ? ` · ${dur}` : ""}
                    </p>
                    <p className="truncate font-sans text-sm text-nabi-ink">
                      {row.title}
                    </p>
                    <p className="text-[10px] text-nabi-muted">
                      {formatWhen(row.createdAt, locale)}
                      {row.receiptId ? ` · ${row.receiptId}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 pt-0.5 text-right font-bold tabular-nums text-rose-300">
                    −{row.creditsCost.toLocaleString()} NC
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </ClientOnly>

      {linkToKabinet && (
        <div className="mt-3 flex justify-end border-t border-amber-500/15 pt-3">
          <Link
            href={profileHref("kabinet")}
            className="text-[11px] text-nabi-neon underline-offset-2 hover:underline"
          >
            {tr("nc_receipts_see_all")} →
          </Link>
        </div>
      )}
    </section>
  );
}
