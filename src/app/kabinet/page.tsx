import { redirect } from "next/navigation";
import { profileHref } from "@/lib/profile-tabs";

/** Legacy menu alias → Profile Kabinet */
export default function KabinetRedirect() {
  redirect(profileHref("kabinet"));
}
