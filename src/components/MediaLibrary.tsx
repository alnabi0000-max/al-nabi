"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download,
  Film,
  ImageIcon,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n/useTranslations";
import { useMaster } from "@/context/MasterControllerContext";
import { useIsMounted } from "@/hooks/useIsMounted";
import {
  loadHistory,
  removeHistoryItem,
  type GenerationRecord,
} from "@/lib/generation-history";
import { formatCredits } from "@/lib/credits";
import { fetchWithTimeout } from "@/lib/api/fetch-timeout";
import { SecurePlayer } from "@/components/SecurePlayer";
import { SecureStill } from "@/components/SecureStill";
import clsx from "clsx";

export type LibraryAsset = {
  id: string;
  kind: string;
  title: string;
  prompt?: string | null;
  mediaUrl?: string | null;
  durationSec: number;
  emotionMode: string;
  creditsCost: number;
  provider?: string | null;
  quality?: string | null;
  createdAt: string;
  source: "db" | "local";
};

function isVideo(kind: string, url?: string | null) {
  if (kind === "image") return false;
  if (url?.match(/\.(png|jpe?g|webp|gif)(\?|$)/i)) return false;
  return kind !== "image";
}

function withSecureKey(url: string | null | undefined, key: string | null) {
  if (!url) return null;
  if (!key || !url.startsWith("/api/media/")) return url;
  const join = url.includes("?") ? "&" : "?";
  return `${url}${join}key=${encodeURIComponent(key)}`;
}

/**
 * Assets & History Gallery — Download 4K · Delete · Re-generate
 */
export function MediaLibrary({
  className,
  onStats,
}: {
  className?: string;
  onStats?: (s: {
    totalSpent: number;
    assetCount: number;
    coins: number | null;
  }) => void;
}) {
  const { t } = useTranslations();
  const { alnabiyKey, coins } = useMaster();
  const router = useRouter();
  const mounted = useIsMounted();
  const [items, setItems] = useState<LibraryAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const local = loadHistory().map(
      (r: GenerationRecord): LibraryAsset => ({
        ...r,
        prompt: r.prompt ?? r.title,
        source: "local",
      })
    );

    if (!alnabiyKey) {
      setItems(local);
      onStats?.({
        totalSpent: local.reduce((s, x) => s + x.creditsCost, 0),
        assetCount: local.length,
        coins: null,
      });
      setLoading(false);
      return;
    }

    try {
      const res = await fetchWithTimeout(
        "/api/assets",
        { headers: { "x-alnabiy-key": alnabiyKey } },
        15_000
      );
      const data = await res.json();
      if (res.ok && data.ok) {
        const dbItems = (data.assets || []) as LibraryAsset[];
        const dbIds = new Set(dbItems.map((x) => x.id));
        const merged = [
          ...dbItems,
          ...local.filter((x) => !dbIds.has(x.id)),
        ].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setItems(merged);
        onStats?.({
          totalSpent:
            data.stats?.totalSpent ??
            merged.reduce((s, x) => s + x.creditsCost, 0),
          assetCount: data.stats?.assetCount ?? merged.length,
          coins: data.stats?.coins ?? null,
        });
      } else {
        setItems(local);
        onStats?.({
          totalSpent: local.reduce((s, x) => s + x.creditsCost, 0),
          assetCount: local.length,
          coins: null,
        });
      }
    } catch {
      setItems(local);
      onStats?.({
        totalSpent: local.reduce((s, x) => s + x.creditsCost, 0),
        assetCount: local.length,
        coins: null,
      });
    } finally {
      setLoading(false);
    }
  }, [alnabiyKey, onStats]);

  useEffect(() => {
    if (!mounted) return;
    void refresh();
  }, [mounted, refresh]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "image") return items.filter((x) => x.kind === "image");
    return items.filter((x) => x.kind !== "image");
  }, [items, filter]);

  async function onDelete(asset: LibraryAsset) {
    if (!confirm(t("media_delete_confirm"))) return;
    setBusyId(asset.id);
    setError(null);
    try {
      if (alnabiyKey) {
        const res = await fetch(`/api/assets/${asset.id}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "x-alnabiy-key": alnabiyKey,
          },
          body: JSON.stringify({ alnabiyKey }),
        });
        // DB yo'q / soft — local o'chirishga ruxsat
        if (!res.ok && asset.source === "db") {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || t("media_delete_failed"));
        }
      }
      removeHistoryItem(asset.id);
      setItems((prev) => prev.filter((x) => x.id !== asset.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error_generic"));
    } finally {
      setBusyId(null);
    }
  }

  function onDownload(asset: LibraryAsset) {
    const url = withSecureKey(asset.mediaUrl, alnabiyKey);
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = isVideo(asset.kind, url)
      ? `alnabiy-4k-${asset.id}.mp4`
      : `alnabiy-4k-${asset.id}.png`;
    a.rel = "noopener";
    a.target = "_blank";
    a.click();
  }

  function onRegenerate(asset: LibraryAsset) {
    const prompt = asset.prompt || asset.title;
    const params = new URLSearchParams({
      prompt,
      emotion: asset.emotionMode || "epic",
    });
    if (asset.kind === "text_to_movie") {
      params.set("mode", "film");
      router.push(`/?${params.toString()}`);
    } else {
      params.set("kind", asset.kind === "image" ? "image" : "video");
      router.push(`/?${params.toString()}`);
    }
  }

  if (!mounted) {
    return (
      <div className={clsx("nabi-card text-sm text-nabi-muted", className)}>
        {t("loading")}
      </div>
    );
  }

  return (
    <section className={clsx("space-y-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("media_library_title")}</h2>
          <p className="text-sm text-nabi-muted">{t("media_library_subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "media_filter_all"],
              ["image", "media_filter_images"],
              ["video", "media_filter_videos"],
            ] as const
          ).map(([id, key]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={clsx(
                "rounded-lg px-3 py-1.5 text-xs transition",
                filter === id
                  ? "bg-gradient-to-r from-[var(--accent-from)]/25 to-[var(--accent-to)]/25 text-nabi-ink"
                  : "bg-nabi-card text-nabi-muted hover:text-nabi-ink"
              )}
            >
              {t(key)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void refresh()}
            className="nabi-btn-ghost !px-2 !py-1.5"
            aria-label={t("media_refresh")}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-rose-400" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-nabi-muted">
          <Loader2 className="animate-spin" size={16} /> {t("loading")}
        </div>
      ) : filtered.length === 0 ? (
        <div className="nabi-card text-sm text-nabi-muted">
          {t("media_empty")}{" "}
          <Link href="/" className="text-nabi-neon underline">
            {t("generate")}
          </Link>
        </div>
      ) : (
        <ul className="nabi-bento">
          {filtered.map((asset) => {
            const url = withSecureKey(asset.mediaUrl, alnabiyKey);
            const video = isVideo(asset.kind, asset.mediaUrl);
            return (
              <li
                key={`${asset.source}-${asset.id}`}
                className="nabi-bento-item group flex min-h-[220px] flex-col"
              >
                <div className="relative min-h-[140px] flex-1 overflow-hidden bg-nabi-input">
                  {url ? (
                    video ? (
                      <SecurePlayer
                        src={url}
                        mode="thumb"
                        hoverPlay
                        autoPlay={false}
                        muted
                        className="h-full min-h-[140px] transition duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <SecureStill
                        src={url}
                        alt={asset.title || "Generated media"}
                        className="h-full min-h-[140px] rounded-none border-0 [&>img]:h-full [&>img]:object-cover [&>img]:transition [&>img]:duration-500 group-hover:[&>img]:scale-[1.03]"
                      />
                    )
                  ) : (
                    <div className="flex h-full min-h-[140px] items-center justify-center text-nabi-muted">
                      {video ? <Film size={28} /> : <ImageIcon size={28} />}
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded-full border border-nabi-border bg-black/50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-nabi-neon backdrop-blur-md">
                    {video ? t("mode_video") : t("mode_image")}
                    {asset.quality ? ` · ${asset.quality}` : ""}
                  </span>
                </div>

                <div className="space-y-3 p-3">
                  <div>
                    <p className="truncate text-sm font-medium">{asset.title}</p>
                    <p className="mt-1 text-[11px] text-nabi-muted">
                      {asset.durationSec}s ·{" "}
                      <span className="text-nabi-gold">
                        {asset.emotionMode}
                      </span>
                      {" · "}
                      {formatCredits(asset.creditsCost)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 opacity-90 transition group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => onDownload(asset)}
                      disabled={!url || busyId === asset.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-nabi-gold/15 px-2.5 py-1.5 text-[11px] font-medium text-nabi-gold transition hover:bg-nabi-gold/25 disabled:opacity-40"
                    >
                      <Download size={12} />
                      {t("media_download_4k")}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRegenerate(asset)}
                      disabled={busyId === asset.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-nabi-neon/15 px-2.5 py-1.5 text-[11px] font-medium text-nabi-neon transition hover:bg-nabi-neon/25"
                    >
                      <RefreshCw size={12} />
                      {t("media_regenerate")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(asset)}
                      disabled={busyId === asset.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-nabi-card px-2.5 py-1.5 text-[11px] font-medium text-nabi-muted transition hover:bg-rose-500/20 hover:text-rose-200 disabled:opacity-40"
                    >
                      {busyId === asset.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Trash2 size={12} />
                      )}
                      {t("media_delete")}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!alnabiyKey && (
        <p className="text-[11px] text-nabi-muted">
          {t("media_local_only", { n: coins })}
        </p>
      )}
    </section>
  );
}
