import { requireAdminPageUser } from "@/lib/admin/require-admin";
import { AdminSecuritySettings } from "@/components/admin/AdminSecuritySettings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdminPageUser();
  return <AdminSecuritySettings />;
}
