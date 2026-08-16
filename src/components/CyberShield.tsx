"use client";

import { useEffect } from "react";
import { useMaster } from "@/context/MasterControllerContext";

/**
 * Halol progressive warning (3-tier) + BAN ekrani.
 */
export function CyberShield() {
  const {
    tr,
    showBanScreen,
    showHalolModal,
    setShowHalolModal,
    isBanned,
    securityAttempts,
  } = useMaster();

  useEffect(() => {
    if (!showHalolModal || isBanned) return;
    const ms = securityAttempts >= 2 ? 7000 : 5000;
    const t = setTimeout(() => setShowHalolModal(false), ms);
    return () => clearTimeout(t);
  }, [showHalolModal, isBanned, setShowHalolModal, securityAttempts]);

  const tier = Math.min(3, Math.max(1, securityAttempts || 1));

  return (
    <>
      {showHalolModal && !showBanScreen && (
        <div
          className="glass-scrim fixed inset-0 z-[1000] flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="halol-warning-title"
        >
          <div className="glass-modal w-full max-w-md p-6">
            <p
              id="halol-warning-title"
              className="mb-2 text-[10px] font-bold uppercase tracking-widest text-amber-400/90"
            >
              Warning {tier} / 3
            </p>
            {tier === 1 && (
              <p className="mb-3 text-xs text-nabi-muted">
                First warning — please follow community guidelines.
              </p>
            )}
            {tier === 2 && (
              <p className="mb-3 text-xs text-amber-300/90">
                Second warning — another violation will restrict your account.
              </p>
            )}
            {tier >= 3 && (
              <p className="mb-3 text-xs text-rose-300">
                Final warning tier reached.
              </p>
            )}
            <p className="mb-4 text-xs font-bold uppercase tracking-wider text-nabi-muted">
              O&apos;zbek
            </p>
            <p className="mb-4 text-sm">{tr("forbiddenUz")}</p>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-nabi-muted">
              Русский
            </p>
            <p className="mb-4 text-sm">{tr("forbiddenRu")}</p>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-nabi-muted">
              English
            </p>
            <p className="mb-4 text-sm">{tr("forbiddenEn")}</p>
            <p className="text-center text-xs text-nabi-muted">
              {tr("halol_auto_close")}
            </p>
          </div>
        </div>
      )}

      {showBanScreen && (
        <div
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black p-6 text-center"
          role="alert"
        >
          <h1 className="text-2xl font-extrabold tracking-widest text-nabi-ink md:text-4xl">
            {tr("bannedTitle")}
          </h1>
          <p className="mt-4 text-xs uppercase tracking-widest text-nabi-muted">
            {tr("coins_frozen")}
          </p>
        </div>
      )}
    </>
  );
}
