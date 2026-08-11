"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

const GenerateStudio = dynamic(() => import("./GenerateStudio"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-7xl animate-pulse space-y-4 py-6">
      <div className="h-8 w-48 rounded-lg bg-zinc-800" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-96 rounded-2xl bg-zinc-900/80" />
        <div className="h-96 rounded-2xl bg-zinc-900/80" />
      </div>
      <p className="text-center text-sm text-zinc-500">Studio yuklanmoqda…</p>
    </div>
  ),
});

export default function GeneratePage() {
  return (
    <Suspense
      fallback={
        <div className="py-8 text-center text-sm text-zinc-500">Loading…</div>
      }
    >
      <GenerateStudio />
    </Suspense>
  );
}
