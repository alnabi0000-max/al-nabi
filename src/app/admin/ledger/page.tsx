import { loadAdminLedger } from "@/lib/admin/ops";
import { requireAdminPageUser } from "@/lib/admin/require-admin";
import { AdminLedgerView } from "@/components/admin/AdminLedgerView";

export const dynamic = "force-dynamic";

export default async function AdminLedgerPage() {
  await requireAdminPageUser();
  let initial: Awaited<ReturnType<typeof loadAdminLedger>> | null = null;
  try {
    initial = await loadAdminLedger({ range: "today" });
  } catch {
    initial = null;
  }
  return <AdminLedgerView initial={initial} />;
}
