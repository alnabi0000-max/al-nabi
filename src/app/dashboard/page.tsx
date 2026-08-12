import { redirect } from "next/navigation";
import { profileRedirectFromSearch } from "@/lib/profile-tabs";

/** Legacy /dashboard → Profile Kabinet tabi */
export default async function DashboardRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  redirect(profileRedirectFromSearch("kabinet", params));
}
