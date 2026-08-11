"use client";

import Link from "next/link";
import { useMaster } from "@/context/MasterControllerContext";
import { CREDIT_RATES, formatCredits } from "@/lib/credits";

export default function BalancePage() {
  const { coins, tr, isBanned } = useMaster();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">{tr("balance")}</h1>
      <div className="nabi-card space-y-4">
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-6 text-center shadow-gold">
          <p className="text-xs uppercase tracking-wider text-nabi-muted">
            {tr("current_balance")}
          </p>
          <p className="mt-2 text-3xl font-extrabold text-nabi-gold">
            {formatCredits(coins)}
          </p>
        </div>
        <div className="space-y-2 text-sm text-nabi-muted">
          <div className="flex justify-between">
            <span>{tr("rate_image")}</span>
            <span className="text-nabi-gold">{CREDIT_RATES.image}</span>
          </div>
          <div className="flex justify-between">
            <span>{tr("rate_video")}</span>
            <span className="text-nabi-gold">
              {CREDIT_RATES.prompt_to_video_per_min}
            </span>
          </div>
          <div className="flex justify-between">
            <span>{tr("rate_movie")}</span>
            <span className="text-nabi-gold">
              {CREDIT_RATES.text_to_movie_per_min}
            </span>
          </div>
          <div className="flex justify-between border-t border-nabi-border pt-2">
            <span>Status</span>
            <span className={isBanned ? "text-rose-400" : "text-emerald-400"}>
              {isBanned ? tr("status_banned") : tr("status_active")}
            </span>
          </div>
        </div>
        <Link href="/store" className="nabi-btn-primary w-full">
          {tr("store")}
        </Link>
      </div>
    </div>
  );
}
