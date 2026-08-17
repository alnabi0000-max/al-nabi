"use client";

import Link from "next/link";
import { Home, RefreshCw, Sparkles } from "lucide-react";
import { useTranslations } from "@/lib/i18n/useTranslations";

type Props =
  | { kind: "not-found"; onRetry?: never }
  | { kind: "error"; onRetry: () => void };

export function RecoveryScreen({ kind, onRetry }: Props) {
  const { t } = useTranslations();
  const notFound = kind === "not-found";

  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-nabi-neon">
        Al-Nabi
      </p>
      <h1 className="text-xl font-bold text-nabi-ink">
        {notFound ? "404" : t("error_title")}
      </h1>
      <p className="text-sm text-nabi-muted">
        {notFound ? t("not_found_description") : t("error_description")}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        {!notFound && (
          <button
            type="button"
            onClick={onRetry}
            className="nabi-btn-primary inline-flex items-center gap-2"
          >
            <RefreshCw size={16} />
            {t("try_again")}
          </button>
        )}
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-nabi-border px-4 py-2 text-sm font-medium text-nabi-ink transition hover:bg-nabi-elevated"
        >
          <Home size={16} />
          {t("go_home")}
        </Link>
        {notFound && (
          <Link
            href="/"
            className="nabi-btn-primary inline-flex items-center gap-2"
          >
            <Sparkles size={16} />
            {t("start_creating")}
          </Link>
        )}
      </div>
    </div>
  );
}
