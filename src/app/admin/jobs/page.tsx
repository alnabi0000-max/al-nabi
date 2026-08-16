import { loadAdminJobs } from "@/lib/admin/ops";
import { requireAdminPageUser } from "@/lib/admin/require-admin";
import { AdminJobsView } from "@/components/admin/AdminJobsView";

export const dynamic = "force-dynamic";

export default async function AdminJobsPage() {
  await requireAdminPageUser();
  let initial: Awaited<ReturnType<typeof loadAdminJobs>> | null = null;
  try {
    initial = await loadAdminJobs({ page: 1, status: "ALL" });
  } catch {
    initial = null;
  }
  return <AdminJobsView initial={initial} />;
}
