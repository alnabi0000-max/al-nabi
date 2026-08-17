"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslations } from "@/lib/i18n/useTranslations";

export function LegalDocument({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  const { t } = useTranslations();

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2 border-b border-nabi-border pb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-nabi-neon">
          Al-Nabi {t("legal")}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-nabi-muted">
          {t("last_updated")}: {updated}
        </p>
      </header>
      <div className="prose-invert space-y-6 text-sm leading-relaxed text-nabi-ink [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-nabi-ink [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
      <footer className="flex flex-wrap gap-4 border-t border-nabi-border pt-6 text-xs text-nabi-muted">
        <Link href="/terms" className="hover:text-nabi-gold">
          {t("terms")}
        </Link>
        <Link href="/privacy" className="hover:text-nabi-gold">
          {t("privacy")}
        </Link>
        <Link href="/refund-policy" className="hover:text-nabi-gold">
          {t("refund_policy")}
        </Link>
        <Link href="/support" className="hover:text-nabi-gold">
          {t("nav_support")}
        </Link>
        <Link href="/" className="hover:text-nabi-gold">
          {t("home")}
        </Link>
      </footer>
    </article>
  );
}
