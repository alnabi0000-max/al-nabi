"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { useMaster } from "@/context/MasterControllerContext";
import { CoinStore } from "@/components/CoinStore";
import { ProfileKabinetPanel } from "@/components/ProfileKabinetPanel";
import { ProfileUmumiyPanel } from "@/components/ProfileUmumiyPanel";
import {
  parseProfileTab,
  profileHref,
  type ProfileTab,
} from "@/lib/profile-tabs";

function ProfileTabs() {
  const searchParams = useSearchParams();
  const { tr } = useMaster();
  const tab = parseProfileTab(searchParams.get("tab"));

  const sections: { id: ProfileTab; label: string }[] = [
    { id: "umumiy", label: tr("profile_tab_umumiy") },
    { id: "kabinet", label: tr("profile_tab_kabinet") },
    { id: "dokon", label: tr("profile_tab_dokon") },
  ];

  return (
    <div
      className={clsx(
        "mx-auto space-y-6",
        tab === "umumiy" ? "max-w-lg" : "max-w-6xl"
      )}
    >
      <div className="flex gap-1 rounded-xl bg-black/30 p-1">
        {sections.map(({ id, label }) => (
          <Link
            key={id}
            href={profileHref(id)}
            scroll={false}
            className={clsx(
              "flex-1 rounded-lg px-3 py-2.5 text-center text-xs font-medium transition md:text-sm",
              tab === id
                ? "bg-cyan-500/20 text-nabi-neon"
                : "text-zinc-500 hover:text-white"
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      {tab === "umumiy" ? (
        <ProfileUmumiyPanel />
      ) : tab === "kabinet" ? (
        <ProfileKabinetPanel />
      ) : (
        <div className="py-2">
          <CoinStore />
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg py-12 text-sm text-nabi-muted">
          …
        </div>
      }
    >
      <ProfileTabs />
    </Suspense>
  );
}
