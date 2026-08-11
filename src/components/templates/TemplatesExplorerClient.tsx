"use client";

import dynamic from "next/dynamic";

const TemplateExplorer = dynamic(
  () =>
    import("@/components/templates/TemplateExplorer").then((m) => ({
      default: m.TemplateExplorer,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto max-w-7xl animate-pulse space-y-6">
        <div className="h-10 w-72 rounded-lg bg-zinc-800" />
        <div className="h-8 w-full max-w-md rounded-full bg-zinc-800/80" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-video rounded-2xl bg-zinc-900" />
          ))}
        </div>
      </div>
    ),
  }
);

export function TemplatesExplorerClient() {
  return <TemplateExplorer />;
}
