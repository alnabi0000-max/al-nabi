import Link from "next/link";
import { useTranslations } from "@/lib/i18n/useTranslations";
import { SUPPORT_EMAIL } from "@/lib/support";

export function SiteFooter() {
  const { t } = useTranslations();

  return (
    <footer className="mt-12 border-t border-nabi-border/60 px-4 py-8 text-xs text-nabi-muted md:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p>
          © {new Date().getFullYear()} Al-Nabi. {t("footer_rights")}
        </p>
        <nav className="flex flex-wrap gap-4">
          <Link href="/support" className="hover:text-nabi-gold">
            {t("nav_support")}
          </Link>
          <Link href="/terms" className="hover:text-nabi-gold">
            {t("terms_of_service")}
          </Link>
          <Link href="/privacy" className="hover:text-nabi-gold">
            {t("privacy_policy")}
          </Link>
          <Link href="/refund-policy" className="hover:text-nabi-gold">
            {t("refund_policy")}
          </Link>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-nabi-gold">
            {SUPPORT_EMAIL}
          </a>
        </nav>
      </div>
    </footer>
  );
}
