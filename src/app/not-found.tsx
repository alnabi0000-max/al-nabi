import Link from "next/link";
import { Home, Sparkles } from "lucide-react";

export const metadata = {
  title: "Page not found — Al-Nabi",
  robots: { index: false, follow: false },
};

/**
 * Branded 404 — replaces the framework default so a bad/old link never
 * looks like the app crashed.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-nabi-neon">
        Al-Nabi
      </p>
      <h1 className="text-4xl font-bold text-white">404</h1>
      <p className="text-sm text-nabi-muted">
        This page doesn&apos;t exist, or it may have moved.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/30"
        >
          <Home size={16} />
          Go home
        </Link>
        <Link
          href="/generate"
          className="inline-flex items-center gap-2 rounded-xl border border-nabi-border px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
        >
          <Sparkles size={16} />
          Start creating
        </Link>
      </div>
    </div>
  );
}
