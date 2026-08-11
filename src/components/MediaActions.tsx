"use client";

import { useState } from "react";
import { Download, Link2, Share2, Check } from "lucide-react";
import { useMaster } from "@/context/MasterControllerContext";
import { useLanguage } from "@/context/LanguageContext";
import { ARCHIVE_REDOWNLOAD_FEE_NC } from "@/lib/credits";
import clsx from "clsx";

type Props = {
  mediaUrl?: string | null;
  generationId?: string | null;
  r2Key?: string | null;
  kind?: "video" | "image";
  title?: string;
  className?: string;
  disabled?: boolean;
  /**
   * Cloud Vault path: first unlock free, later re-downloads charge 5 NC.
   * Set false for fresh generate preview downloads.
   */
  archiveFee?: boolean;
};

/**
 * Download · Signed URL · Share — Cloud Vault fee aware.
 */
export function MediaActions({
  mediaUrl,
  generationId,
  r2Key,
  kind = "video",
  title = "Al-Nabi",
  className,
  disabled,
  archiveFee = true,
}: Props) {
  const { tr, alnabiyKey, notify, applyServerCharge } = useMaster();
  const { t } = useLanguage();
  const [busy, setBusy] = useState<"dl" | "sign" | "share" | null>(null);
  const [signed, setSigned] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const playable = signed || mediaUrl;

  async function resolveVaultUrl(): Promise<string | null> {
    if (!generationId || !archiveFee) {
      return resolveSigned();
    }
    setBusy("dl");
    try {
      const res = await fetch("/api/media/redownload", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(alnabiyKey ? { "x-alnabiy-key": alnabiyKey } : {}),
        },
        body: JSON.stringify({ generationId, archive: true }),
      });
      const data = await res.json();
      if (res.status === 402) {
        applyServerCharge({ ok: false, code: "INSUFFICIENT" });
        return null;
      }
      if (!res.ok) throw new Error(data.error || "Vault download failed");
      if (typeof data.balanceAfter === "number") {
        applyServerCharge({
          ok: true,
          cost: data.feeNc || 0,
          balanceAfter: data.balanceAfter,
          label: data.message || "Cloud Vault",
        });
      }
      if (data.feeNc > 0) {
        notify({
          message: `Cloud Vault · ${data.feeNc} NC`,
          type: "info",
        });
      }
      const url = (data.signedUrl || data.url || mediaUrl) as string;
      setSigned(url);
      return url;
    } catch (e) {
      notify({
        message: e instanceof Error ? e.message : tr("error_generic"),
        type: "error",
      });
      return mediaUrl || null;
    } finally {
      setBusy(null);
    }
  }

  async function resolveSigned(): Promise<string | null> {
    if (signed) return signed;
    if (!generationId && !r2Key && !mediaUrl) return null;

    setBusy("sign");
    try {
      const res = await fetch("/api/media/sign", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(alnabiyKey ? { "x-alnabiy-key": alnabiyKey } : {}),
        },
        body: JSON.stringify({
          generationId: generationId || undefined,
          key: r2Key || undefined,
          url: mediaUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sign failed");
      const url = (data.signedUrl || data.url) as string;
      setSigned(url);
      return url;
    } catch (e) {
      notify({
        message: e instanceof Error ? e.message : tr("error_generic"),
        type: "error",
      });
      return mediaUrl || null;
    } finally {
      setBusy(null);
    }
  }

  async function onDownload() {
    if (disabled || !playable) return;
    const url =
      (await (archiveFee && generationId
        ? resolveVaultUrl()
        : resolveSigned())) || playable;
    if (!url) return;
    setBusy("dl");
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download =
        kind === "image" ? "alnabi-image.png" : "alnabi-video.mp4";
      a.rel = "noopener";
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setBusy(null);
    }
  }

  async function onShare() {
    if (disabled) return;
    setBusy("share");
    try {
      const url =
        (await resolveSigned()) ||
        playable ||
        (typeof window !== "undefined" ? window.location.href : "");
      if (!url) return;

      if (navigator.share) {
        await navigator.share({
          title: `${title} · Al-Nabi`,
          text: tr("share_media_text"),
          url,
        });
      } else {
        await navigator.clipboard?.writeText(url);
        setCopied(true);
        notify({ message: tr("link_copied"), type: "success" });
        window.setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* cancelled */
    } finally {
      setBusy(null);
    }
  }

  async function onCopySigned() {
    if (disabled) return;
    const url = await resolveSigned();
    if (!url) return;
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    notify({ message: tr("signed_url_ready"), type: "success" });
    window.setTimeout(() => setCopied(false), 2000);
  }

  const inactive = disabled || !mediaUrl;

  return (
    <div className={clsx("flex flex-wrap gap-2", className)}>
      <button
        type="button"
        onClick={() => void onDownload()}
        disabled={inactive || busy === "dl"}
        className="nabi-btn-primary !text-xs"
        title={
          archiveFee && generationId
            ? `Cloud Vault · first free, then ${ARCHIVE_REDOWNLOAD_FEE_NC} NC`
            : undefined
        }
      >
        <Download size={14} />
        {t.common.download}
        {archiveFee && generationId ? (
          <span className="ml-1 opacity-70">· {t.common.vault}</span>
        ) : null}
      </button>
      <button
        type="button"
        onClick={() => void onShare()}
        disabled={inactive || busy === "share"}
        className="nabi-btn-ghost !text-xs"
      >
        {copied ? <Check size={14} /> : <Share2 size={14} />}
        {t.common.share}
      </button>
      <button
        type="button"
        onClick={() => void onCopySigned()}
        disabled={inactive || busy === "sign"}
        className="nabi-btn-ghost !text-xs"
        title={tr("signed_url_hint")}
      >
        <Link2 size={14} />
        {tr("get_signed_url")}
      </button>
    </div>
  );
}
