import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-nabi-border/60 px-4 py-8 text-xs text-zinc-500 md:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} Al-Nabi. All rights reserved.</p>
        <nav className="flex flex-wrap gap-4">
          <Link href="/terms" className="hover:text-nabi-neon">
            Terms of Service
          </Link>
          <Link href="/privacy" className="hover:text-nabi-neon">
            Privacy Policy
          </Link>
          <Link href="/refund-policy" className="hover:text-nabi-neon">
            Refund Policy
          </Link>
          <a
            href="mailto:legal@alnabiy.app"
            className="hover:text-nabi-neon"
          >
            legal@alnabiy.app
          </a>
        </nav>
      </div>
    </footer>
  );
}
