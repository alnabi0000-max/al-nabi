"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMaster } from "@/context/MasterControllerContext";
import { useAuthUi } from "@/context/AuthUiContext";
import {
  isOAuthErrorReason,
  oauthErrorMessageKey,
} from "@/lib/auth/oauth-errors";

/**
 * Google / Magic Link / OTP return — toast + session refresh + clean URL.
 */
function AuthReturnInner() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { refreshSession, notify, tr } = useMaster();
  const { openAuth } = useAuthUi();
  const ran = useRef(false);

  useEffect(() => {
    const auth = params.get("auth");
    if (auth !== "ok" && auth !== "error" && auth !== "local") return;
    if (ran.current) return;
    ran.current = true;

    const reason = params.get("reason");
    const clean = () => {
      const next = new URLSearchParams(params.toString());
      next.delete("auth");
      next.delete("reason");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    };

    void (async () => {
      if (auth === "ok") {
        await refreshSession();
        notify({
          type: "success",
          message: tr("auth_oauth_success"),
        });
        clean();
        return;
      }

      if (auth === "local") {
        notify({
          type: "info",
          message: tr("auth_local_hint"),
        });
        clean();
        return;
      }

      const key = isOAuthErrorReason(reason)
        ? oauthErrorMessageKey(reason)
        : "auth_oauth_error";
      notify({
        type: "error",
        message: tr(key),
      });
      openAuth("quick");
      clean();
    })();
  }, [notify, openAuth, params, pathname, refreshSession, router, tr]);

  return null;
}

export function AuthReturnHandler() {
  return (
    <Suspense fallback={null}>
      <AuthReturnInner />
    </Suspense>
  );
}
