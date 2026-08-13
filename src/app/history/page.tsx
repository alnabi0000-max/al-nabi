import { redirect } from "next/navigation";
import { profileHref } from "@/lib/profile-tabs";

/** Legacy /history → Profile Kabinet (gallery) */
export default function HistoryRedirect() {
  redirect(profileHref("kabinet"));
}
