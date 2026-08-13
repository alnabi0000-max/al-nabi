"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import type { StudioTemplate } from "@/lib/templates/types";
import {
  buildTransferPayload,
  fillTemplatePrompt,
  resolveTemplatePreset,
  saveTemplateTransfer,
} from "@/lib/templates/resolve";
import { TemplatePreviewMedia } from "@/components/templates/TemplatePreviewMedia";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useMaster } from "@/context/MasterControllerContext";

type Props = {
  template: StudioTemplate | null;
  open: boolean;
  onClose: () => void;
};

export function TemplateFastUseDrawer({ template, open, onClose }: Props) {
  const router = useRouter();
  const { tr } = useMaster();
  const inputId = useId();
  const [subject, setSubject] = useState("");
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!template) return;
    setSubject("");
  }, [template]);

  useDialogFocus(panelRef, open, onClose);

  if (!open || !template) return null;

  const resolved = resolveTemplatePreset(template);
  const previewPrompt = fillTemplatePrompt(
    template,
    subject || template.subject_placeholder
  );

  function transfer() {
    if (!template) return;
    const payload = buildTransferPayload(
      template,
      subject || template.subject_placeholder
    );
    saveTemplateTransfer(payload);
    onClose();
    router.push(
      `/?template=${template.id}&from=explorer&subject=${encodeURIComponent(payload.subject)}`
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex justify-end">
      <button
        type="button"
        aria-label={tr("close")}
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tpl-drawer-title"
        tabIndex={-1}
        className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-nabi-border bg-nabi-surface shadow-2xl outline-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-nabi-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-nabi-muted">
              Fast Use · {template.category}
            </p>
            <h2
              id="tpl-drawer-title"
              className="mt-1 truncate text-lg font-semibold text-nabi-ink"
            >
              {template.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr("close")}
            className="rounded-lg p-2 text-nabi-muted transition hover:bg-nabi-elevated hover:text-nabi-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div className="overflow-hidden rounded-xl border border-nabi-border bg-black">
            <TemplatePreviewMedia
              key={template.id}
              templateId={template.id}
              previewVideo={template.preview_video}
              autoPlay
              className="aspect-video"
            />
          </div>

          <div className="rounded-xl border border-white/8 bg-nabi-card p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-nabi-muted">
              Prompt structure
            </p>
            <p className="mt-2 font-mono text-[12px] leading-relaxed text-nabi-ink">
              {template.prompt_structure}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-nabi-muted">
              <span className="rounded-md border border-nabi-border px-2 py-0.5">
                {resolved.aspect}
              </span>
              <span className="rounded-md border border-nabi-border px-2 py-0.5">
                Motion {template.system_preset.motion_level}/5
              </span>
              <span className="rounded-md border border-nabi-border px-2 py-0.5">
                {resolved.publicModelLabel}
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor={inputId}
              className="mb-2 block text-xs font-medium uppercase tracking-wider text-nabi-muted"
            >
              Obyektingiz / subject
            </label>
            <input
              id={inputId}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={template.subject_placeholder}
              className="w-full rounded-xl border border-nabi-border bg-nabi-input px-3 py-2.5 text-sm text-nabi-ink outline-none transition placeholder:text-nabi-muted focus:border-nabi-neon/40"
              autoFocus
            />
            <p className="mt-2 text-[11px] leading-relaxed text-nabi-muted">
              Preview:{" "}
              <span className="text-nabi-muted">{previewPrompt.slice(0, 160)}</span>
              {previewPrompt.length > 160 ? "…" : ""}
            </p>
          </div>
        </div>

        <div className="border-t border-nabi-border p-5">
          <button
            type="button"
            onClick={transfer}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-nabi-bg transition hover:bg-nabi-muted"
          >
            <Sparkles size={16} />
            Shu uslubda yaratish
          </button>
          <p className="mt-2 text-center text-[11px] text-nabi-muted">
            Stil, aspekt va model Studio generatoriga uzatiladi
          </p>
        </div>
      </aside>
    </div>
  );
}
