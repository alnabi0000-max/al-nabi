"use client";

import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { useMaster } from "@/context/MasterControllerContext";

const GenerateStudio = dynamic(() => import("@/app/generate/GenerateStudio"), {
  ssr: false,
  loading: () => <StudioSkeleton film={false} />,
});

const ScriptToMovieStudio = dynamic(
  () =>
    import("@/components/ScriptToMovieStudio").then((m) => ({
      default: m.ScriptToMovieStudio,
    })),
  {
    ssr: false,
    loading: () => <StudioSkeleton film />,
  }
);

function StudioSkeleton({ film }: { film: boolean }) {
  if (film) {
    return (
      <div className="mx-auto max-w-5xl animate-pulse space-y-4 py-8">
        <div className="h-64 rounded-2xl bg-nabi-card" />
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-[1680px] animate-pulse space-y-6 py-8">
      <div className="h-10 w-40 rounded-full bg-white/10" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="h-64 rounded-2xl bg-nabi-card" />
        <div className="aspect-video rounded-2xl bg-nabi-card" />
      </div>
    </div>
  );
}

function studioHref(mode: "video" | "film", current: URLSearchParams) {
  const q = new URLSearchParams(current.toString());
  if (mode === "film") q.set("mode", "film");
  else q.delete("mode");
  const s = q.toString();
  return s ? `/?${s}` : "/";
}

function HomeStudioInner() {
  const searchParams = useSearchParams();
  const { tr } = useMaster();
  const film = searchParams.get("mode") === "film";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="mx-auto max-w-[1680px] space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link
          href={studioHref("video", searchParams)}
          scroll={false}
          suppressHydrationWarning
          className={clsx(
            "nabi-select px-4 py-1.5",
            !film && "nabi-select-on"
          )}
        >
          {tr("mode_prompt")}
        </Link>
        <Link
          href={studioHref("film", searchParams)}
          scroll={false}
          suppressHydrationWarning
          className={clsx(
            "nabi-select px-4 py-1.5",
            film && "nabi-select-on"
          )}
        >
          {tr("mode_script_film")}
        </Link>
      </div>
      {mounted ? (
        film ? (
          <ScriptToMovieStudio />
        ) : (
          <GenerateStudio />
        )
      ) : (
        <StudioSkeleton film={film} />
      )}
    </div>
  );
}

export function HomeStudio() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-sm text-nabi-muted">…</div>
      }
    >
      <HomeStudioInner />
    </Suspense>
  );
}
