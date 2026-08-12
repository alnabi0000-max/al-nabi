import { redirect } from "next/navigation";
import { profileRedirectFromSearch } from "@/lib/profile-tabs";

/** Legacy /store → Profile Do'kon tabi (checkout/ref query saqlanadi) */
export default async function StoreRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  redirect(profileRedirectFromSearch("dokon", params));
}
