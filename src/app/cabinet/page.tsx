import { redirect } from "next/navigation";
import { profileHref } from "@/lib/profile-tabs";

/** Legacy English alias → Profile Kabinet */
export default function CabinetRedirect() {
  redirect(profileHref("kabinet"));
}
