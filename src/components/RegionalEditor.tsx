"use client";

import { useState } from "react";
import { useMaster } from "@/context/MasterControllerContext";

type Mode = "inpaint" | "outpaint" | null;

export function RegionalEditor() {
  const { tr } = useMaster();
  const [mode, setMode] = useState<Mode>(null);
  const [status, setStatus] = useState<string | null>(null);

  function run(m: Mode) {
    setMode(m);
    setStatus(m === "inpaint" ? tr("inpaint_start") : tr("outpaint_start"));
    setTimeout(() => {
      setStatus(m === "inpaint" ? tr("inpaint_done") : tr("outpaint_done"));
    }, 1600);
  }

  return (
    <div className="nabi-card space-y-3">
      <h3 className="text-sm font-medium text-nabi-muted">
        {tr("regional_editor")}
      </h3>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => run("inpaint")}
          className={`nabi-btn-ghost !text-xs ${
            mode === "inpaint" ? "nabi-select-on" : ""
          }`}
        >
          {tr("inpaint")}
        </button>
        <button
          type="button"
          onClick={() => run("outpaint")}
          className={`nabi-btn-ghost !text-xs ${
            mode === "outpaint" ? "nabi-select-on" : ""
          }`}
        >
          {tr("outpaint")}
        </button>
      </div>
      {status && (
        <p className="rounded-lg border border-nabi-border bg-nabi-surface px-3 py-2 text-xs text-nabi-muted">
          {status}
        </p>
      )}
    </div>
  );
}
