import { redirect } from "next/navigation";
import { profileHref } from "@/lib/profile-tabs";

/** Legacy menu alias → Profile Do'kon */
export default function CoinStoreRedirect() {
  redirect(profileHref("dokon"));
}
