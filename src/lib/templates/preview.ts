import { previewFallbackForId } from "@/lib/templates/preview-pool";

export const TEMPLATE_POSTER_SRC = "/templates/poster-placeholder.svg";

/** Local optional clips — often missing in public/templates. */
export function isLocalTemplatePreview(url: string): boolean {
  return /^\/templates\/preview_\d+\.mp4$/i.test(url);
}

/**
 * Prefer a known-good remote sample when the catalog points at a missing local file.
 * Empty preview_video → no remote fetch (poster-only strips).
 */
export function initialTemplatePreviewSrc(template: {
  id: number;
  preview_video: string;
}): string | null {
  const v = (template.preview_video || "").trim();
  if (!v) return null;
  if (isLocalTemplatePreview(v)) {
    return previewFallbackForId(template.id);
  }
  return v;
}

export function nextTemplatePreviewSrc(
  templateId: number,
  currentSrc: string
): string | null {
  const fb = previewFallbackForId(templateId);
  if (fb && fb !== currentSrc) return fb;
  return null;
}
