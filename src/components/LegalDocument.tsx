import Link from "next/link";
import type { ReactNode } from "react";

export function LegalDocument({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2 border-b border-nabi-border pb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-nabi-neon">
          Al-Nabi Legal
        </p>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-nabi-muted">Last updated: {updated}</p>
      </header>
      <div className="prose-invert space-y-6 text-sm leading-relaxed text-nabi-ink [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-nabi-ink [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
      <footer className="flex flex-wrap gap-4 border-t border-nabi-border pt-6 text-xs text-nabi-muted">
        <Link href="/terms" className="hover:text-nabi-neon">
          Terms
        </Link>
        <Link href="/privacy" className="hover:text-nabi-neon">
          Privacy
        </Link>
        <Link href="/refund-policy" className="hover:text-nabi-neon">
          Refund Policy
        </Link>
        <Link href="/" className="hover:text-nabi-neon">
          Home
        </Link>
      </footer>
    </article>
  );
}
