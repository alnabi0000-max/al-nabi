/** Tiny util — avoid importing the full MediaViewer module just to scroll. */
export function scrollToMediaViewer() {
  if (typeof document === "undefined") return;
  document
    .getElementById("media-viewer")
    ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
