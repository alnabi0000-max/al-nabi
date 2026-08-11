"use client";

import { useState } from "react";
import { useMaster } from "@/context/MasterControllerContext";
import { scanHalol } from "@/lib/halol";
import { Loader2, Shield } from "lucide-react";

interface Props {
  onImage?: (dataUrl: string) => void;
}

/**
 * FUNC-02: Face Match — server /api/identity/face-match ga yuboradi.
 */
export function IdentityLock({ onImage }: Props) {
  const { identityLocked, setIdentityLocked, handleViolation, tr, notify } =
    useMaster();
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  async function onFile(file: File) {
    if (scanHalol(file.name).blocked) {
      handleViolation();
      return;
    }
    if (!file.type.startsWith("image/")) {
      notify({ message: "Image required", type: "error" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify({ message: "Max 5MB", type: "error" });
      return;
    }

    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
      });

      setPreview(dataUrl);

      const res = await fetch("/api/identity/face-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data.matched) {
        setIdentityLocked(false);
        setScore(null);
        notify({
          message: data.error || "Face match failed",
          type: "error",
        });
        return;
      }

      setIdentityLocked(true);
      setScore(typeof data.score === "number" ? data.score : 0.8);
      onImage?.(data.enhancedUrl || dataUrl);
      notify({
        message: tr("identity_locked_full") || "Identity locked",
        type: "success",
      });
    } catch (e) {
      setIdentityLocked(false);
      notify({
        message: e instanceof Error ? e.message : "Face match error",
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="nabi-card space-y-3">
      <h3 className="text-sm font-medium text-nabi-muted">
        {tr("upload_avatar")}
      </h3>
      <label className="relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-nabi-border transition-all duration-300 ease-apple hover:scale-[1.01] hover:border-nabi-neon">
        {busy && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
            <Loader2 className="animate-spin text-nabi-neon" size={28} />
          </div>
        )}
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Identity"
            className="max-h-36 w-full object-cover"
          />
        ) : (
          <p className="text-xs text-zinc-500">{tr("identity_sim")}</p>
        )}
        <input
          type="file"
          accept="image/*"
          disabled={busy}
          className="absolute inset-0 opacity-0"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
      </label>
      {identityLocked && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-400">
          <Shield size={14} />
          {tr("identity_locked_full")}
          {score != null && (
            <span className="ml-auto font-normal text-emerald-300/80">
              {(score * 100).toFixed(0)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}
