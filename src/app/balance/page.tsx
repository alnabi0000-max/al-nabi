import { redirect } from "next/navigation";
import { profileHref } from "@/lib/profile-tabs";

/** Legacy /balance → Profile Kabinet */
export default function BalanceRedirect() {
  redirect(profileHref("kabinet"));
}
