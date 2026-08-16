import { loadAdminUsers } from "@/lib/admin/ops";
import { requireAdminPageUser } from "@/lib/admin/require-admin";
import { AdminUsersView } from "@/components/admin/AdminUsersView";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireAdminPageUser();
  let initial: Awaited<ReturnType<typeof loadAdminUsers>> | null = null;
  try {
    initial = await loadAdminUsers({ page: 1 });
  } catch {
    initial = null;
  }
  return <AdminUsersView initial={initial} />;
}
