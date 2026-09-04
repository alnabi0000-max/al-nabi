import clsx from "clsx";
import type { PipelineLogEntry } from "@/lib/generation/pipeline";

const STAGE_LABEL: Record<string, string> = {
  queue: "Queue",
  "mock-persist": "Mock-Persist",
  "player-render": "Player Render",
};

export function StudioPipelineLog({
  entries,
}: {
  entries: PipelineLogEntry[];
}) {
  if (!entries.length) return null;

  return (
    <ol className="mt-2 space-y-1 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 font-mono text-[10px] leading-relaxed">
      {entries.map((entry, index) => (
        <li
          key={`${entry.at}-${index}`}
          className={clsx(
            entry.status === "error" && "text-rose-400",
            entry.status === "recovered" && "text-amber-300",
            entry.status === "ok" && "text-white/45"
          )}
        >
          <span className="text-white/35">{STAGE_LABEL[entry.stage] || entry.stage}</span>
          {" · "}
          {entry.status}
          {entry.code ? ` · ${entry.code}` : ""}
          {" · "}
          {entry.message}
        </li>
      ))}
    </ol>
  );
}
