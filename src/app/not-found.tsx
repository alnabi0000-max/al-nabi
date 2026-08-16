import { RecoveryScreen } from "@/components/RecoveryScreen";

export const metadata = {
  title: "Page not found — Al-Nabi",
  robots: { index: false, follow: false },
};

/**
 * Branded 404 — replaces the framework default so a bad/old link never
 * looks like the app crashed.
 */
export default function NotFound() {
  return <RecoveryScreen kind="not-found" />;
}
