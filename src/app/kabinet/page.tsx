import { redirect } from "next/navigation";

/** Legacy menu alias → shaxsiy kabinet */
export default function KabinetRedirect() {
  redirect("/dashboard");
}
