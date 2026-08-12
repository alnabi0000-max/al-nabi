"use client";

import { MediaLibrary } from "@/components/MediaLibrary";
import { useTranslations } from "@/lib/i18n/useTranslations";
import Link from "next/link";

/** Legacy /history → Media Library (dashboard bilan bir xil galereya) */
export default function HistoryPage() {
  const { t } = useTranslations();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-nabi-neon/80">
            Gallery
          </p>
          <h1 className="bg-cinema-accent bg-clip-text text-3xl font-bold text-transparent">
            {t("history")}
          </h1>
          <p className="mt-1 text-sm text-nabi-muted">{t("history_subtitle")}</p>
        </div>
        <Link
          href="/profile?tab=kabinet"
          className="text-sm text-nabi-neon underline decoration-nabi-neon/40 underline-offset-4"
        >
          {t("dashboard_title")}
        </Link>
      </div>
      <MediaLibrary />
    </div>
  );
}
