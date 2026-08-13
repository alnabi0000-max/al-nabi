import { redirect } from "next/navigation";
import { homeRedirectFromSearch } from "@/lib/home-redirect";

/** Legacy /script-to-movie → Studio Film mode */
export default async function ScriptToMovieRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  redirect(homeRedirectFromSearch(params, { mode: "film" }));
}
