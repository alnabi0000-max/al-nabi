import { redirect } from "next/navigation";
import { homeRedirectFromSearch } from "@/lib/home-redirect";

/** Legacy /templates → Studio with templates open */
export default async function TemplatesRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  redirect(homeRedirectFromSearch(params, { templates: "1" }));
}
