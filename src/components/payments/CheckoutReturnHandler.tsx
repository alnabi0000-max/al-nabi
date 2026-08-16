"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMaster } from "@/context/MasterControllerContext";
import { useTopUpUi } from "@/context/TopUpUiContext";
import { fetchWithTimeout } from "@/lib/api/fetch-timeout";
import { COIN_PACKS, isPackPriceId, packTotalCoins } from "@/lib/credits";
import { packDisplayName } from "@/components/payments/NcPackGrid";

function CheckoutReturnInner() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { refreshSession, notify, tr } = useMaster();
  const { celebrateTopUp } = useTopUpUi();
  const ran = useRef(false);

  useEffect(() => {
    const checkout = params.get("checkout");
    const sessionId = params.get("session_id");
    const packParam = params.get("pack");
    if (checkout !== "success" && checkout !== "demo") return;
    if (ran.current) return;
    ran.current = true;

    const clean = () => {
      const next = new URLSearchParams(params.toString());
      next.delete("checkout");
      next.delete("session_id");
      next.delete("paid");
      next.delete("pack");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    };

    void (async () => {
      let credited = 0;
      let packName = tr("coins");
      if (packParam && isPackPriceId(packParam)) {
        const pack = COIN_PACKS.find((p) => p.id === packParam);
        if (pack) {
          credited = packTotalCoins(pack);
          packName = packDisplayName(pack, tr);
        }
      }

      if (sessionId) {
        for (let i = 0; i < 20; i++) {
          try {
            const res = await fetchWithTimeout(
              `/api/payments/checkout?session_id=${encodeURIComponent(sessionId)}`,
              { credentials: "include", cache: "no-store" },
              12_000
            );
            const data = await res.json();
            if (data.ok && data.paid) {
              credited =
                typeof data.credited === "number" ? data.credited : credited;
              if (data.packId && isPackPriceId(data.packId)) {
                const pack = COIN_PACKS.find((p) => p.id === data.packId);
                if (pack) packName = packDisplayName(pack, tr);
              }
              break;
            }
          } catch {
            /* retry */
          }
          await new Promise((r) => window.setTimeout(r, 1200));
        }
      }

      await refreshSession();
      if (credited > 0) {
        celebrateTopUp({ totalNc: credited, packName });
        notify({
          type: "success",
          title: tr("topup_success_title"),
          message: tr("topup_success_body", { n: credited.toLocaleString() }),
          durationMs: 5600,
        });
      } else if (checkout === "success") {
        notify({
          type: "info",
          title: tr("topup_processing"),
          message: tr("topup_processing_hint"),
        });
      }
      clean();
    })();
  }, [celebrateTopUp, notify, params, pathname, refreshSession, router, tr]);

  return null;
}

export function CheckoutReturnHandler() {
  return (
    <Suspense fallback={null}>
      <CheckoutReturnInner />
    </Suspense>
  );
}
