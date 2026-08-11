import { redirect } from "next/navigation";

/** Legacy menu alias → coin store */
export default function CoinStoreRedirect() {
  redirect("/store");
}
