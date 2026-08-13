import { redirect } from "next/navigation";
import { homeRedirectFromSearch } from "@/lib/home-redirect";

/** Legacy /generate → Studio home */
export default async function GenerateRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  redirect(homeRedirectFromSearch(params));
}
