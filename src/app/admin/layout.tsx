import type { Metadata } from "next";
import { requireAdminPageUser } from "@/lib/admin/require-admin";
import { AdminPanelNav } from "@/components/admin/AdminPanelNav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPageUser();
  return (
    <>
      <AdminPanelNav />
      {children}
    </>
  );
}
