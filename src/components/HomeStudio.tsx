"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { useMaster } from "@/context/MasterControllerContext";

const GenerateStudio = dynamic(() => import("@/app/generate/GenerateStudio"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-6xl animate-pulse space-y-6 py-8">
      <div className="h-10 w-40 rounded-full bg-nabi-elevated" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="h-64 rounded-2xl bg-nabi-card" />
        <div className="aspect-video rounded-2xl bg-nabi-card" />
      </div>
    </div>
  ),
});

const ScriptToMovieStudio = dynamic(
  () =>
    import("@/components/ScriptToMovieStudio").then((m) => ({
      default: m.ScriptToMovieStudio,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto max-w-5xl animate-pulse space-y-4 py-8">
        <div className="h-64 rounded-2xl bg-nabi-card" />
      </div>
    ),
  }
);

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

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="inline-flex rounded-full border border-nabi-border bg-nabi-card p-1">
        <Link
          href={studioHref("video", searchParams)}
          scroll={false}
          className={clsx(
            "rounded-full px-4 py-1.5 text-sm transition",
            !film
              ? "bg-nabi-elevated text-nabi-ink"
              : "text-nabi-muted hover:text-nabi-ink"
          )}
        >
          {tr("mode_prompt")}
        </Link>
        <Link
          href={studioHref("film", searchParams)}
          scroll={false}
          className={clsx(
            "rounded-full px-4 py-1.5 text-sm transition",
            film
              ? "bg-nabi-elevated text-nabi-ink"
              : "text-nabi-muted hover:text-nabi-ink"
          )}
        >
          {tr("mode_script_film")}
        </Link>
      </div>
      {film ? <ScriptToMovieStudio /> : <GenerateStudio />}
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
