/**
 * Provider-facing prompt enrichment. These directives are appended only at
 * generation time, so they never replace or alter the user's creative brief.
 */

export type HiddenPromptExpansionOptions = {
  /** Disable the rendering directives for providers that do not support video. */
  enabled?: boolean;
};

export type HiddenPromptExpansion = {
  /** The original, normalized user prompt. */
  sourcePrompt: string;
  /** Rendering instructions appended invisibly to the provider prompt. */
  hiddenDirectives: string;
  /** The string sent to the generation provider. */
  expandedPrompt: string;
};

const HIDDEN_DIRECTIVES = [
  "DiT 3D spatiotemporal attention for stable geometry, depth-aware motion, and temporal continuity",
  "Cameron-inspired volumetric lighting with physically motivated shafts, atmospheric depth, and controlled practical highlights",
  "anamorphic 2.39:1 lens language, 40mm anamorphic lens, T2.8, subtle oval bokeh, restrained horizontal flare, cinematic depth of field",
] as const;

const DIRECTIVE_MARKERS = [
  /\bdit\s*3d\s*spatio(?:temporal|time)\s*attention\b/i,
  /\bcameron(?:-inspired)?\s+volumetric\s+lighting\b/i,
  /\banamorphic\s+2\.39\s*:\s*1\s+lens\s+language\b/i,
] as const;

/**
 * Expands a user-facing prompt with a stable, hidden technical baseline.
 * Repeated calls are idempotent, which lets every generation entry point use it
 * without duplicating prompt text.
 */
export function expandHiddenVideoPrompt(
  prompt: string,
  options: HiddenPromptExpansionOptions = {}
): HiddenPromptExpansion {
  const sourcePrompt = prompt.trim();
  const enabled = options.enabled ?? true;
  const alreadyExpanded = DIRECTIVE_MARKERS.every((marker) =>
    marker.test(sourcePrompt)
  );
  const hiddenDirectives =
    enabled && !alreadyExpanded ? HIDDEN_DIRECTIVES.join("; ") : "";

  return {
    sourcePrompt,
    hiddenDirectives,
    expandedPrompt: hiddenDirectives
      ? `${sourcePrompt}${sourcePrompt ? ". " : ""}${hiddenDirectives}.`
      : sourcePrompt,
  };
}

/** Convenience form for generation call sites that only need provider text. */
export function expandPromptForVideoGeneration(prompt: string): string {
  return expandHiddenVideoPrompt(prompt).expandedPrompt;
}
