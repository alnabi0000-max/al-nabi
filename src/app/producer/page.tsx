import { redirect } from "next/navigation";
import { homeRedirectFromSearch } from "@/lib/home-redirect";

/** Legacy /producer → Studio + open chat */
export default async function ProducerRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  redirect(homeRedirectFromSearch(params, { chat: "1" }));
}
