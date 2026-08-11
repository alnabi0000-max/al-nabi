import { redirect } from "next/navigation";

/** Legacy English alias → shaxsiy kabinet */
export default function CabinetRedirect() {
  redirect("/dashboard");
}
