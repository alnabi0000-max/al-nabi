import { loadAdminAnalytics } from "@/lib/admin/analytics";
import { requireAdminPageUser } from "@/lib/admin/require-admin";
import { AdminAnalyticsDashboard } from "@/components/admin/AdminAnalyticsDashboard";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdminPageUser();
  let initial: Awaited<ReturnType<typeof loadAdminAnalytics>> | null = null;
  try {
    initial = await loadAdminAnalytics({ range: "today" });
  } catch {
    initial = null;
  }
  return <AdminAnalyticsDashboard initial={initial} />;
}
