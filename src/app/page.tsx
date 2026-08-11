"use client";

import dynamic from "next/dynamic";

const StudioHub = dynamic(
  () =>
    import("@/components/StudioHub").then((m) => ({ default: m.StudioHub })),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto max-w-5xl animate-pulse space-y-4">
        <div className="h-10 w-48 rounded-lg bg-nabi-elevated" />
        <div className="h-40 rounded-2xl bg-nabi-card" />
        <div className="h-48 rounded-2xl bg-nabi-card" />
      </div>
    ),
  }
);

export default function HomePage() {
  return <StudioHub />;
}
