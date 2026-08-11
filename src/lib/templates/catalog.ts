import { buildStudioTemplateCatalog } from "@/lib/templates/generate-catalog";
import type { StudioTemplate, TemplateCategory } from "@/lib/templates/types";

/** Lazy full catalog — avoid 512-object alloc at module import (main-thread long task). */
let catalogCache: StudioTemplate[] | null = null;

function ensureCatalog(): StudioTemplate[] {
  if (!catalogCache) {
    catalogCache = buildStudioTemplateCatalog(512);
  }
  return catalogCache;
}

export function getStudioTemplate(id: number): StudioTemplate | undefined {
  return ensureCatalog().find((t) => t.id === id);
}

export function listStudioTemplates(
  category?: string,
  opts?: { q?: string; limit?: number; offset?: number }
): StudioTemplate[] {
  let list = ensureCatalog();
  if (category && category !== "All") {
    list = list.filter(
      (t) => t.category.toLowerCase() === category.toLowerCase()
    );
  }
  const q = opts?.q?.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.base_prompt.toLowerCase().includes(q)
    );
  }
  const offset = opts?.offset ?? 0;
  const limit = opts?.limit;
  if (typeof limit === "number") {
    return list.slice(offset, offset + limit);
  }
  return list.slice(offset);
}

export function countStudioTemplates(category?: string, q?: string): number {
  return listStudioTemplates(category, { q }).length;
}

/**
 * Small strip for Studio — light catalog + poster-only previews
 * (no remote mp4 on /generate first paint).
 *
 * Must slice from the same full `ensureCatalog()` cache used everywhere
 * else — building a separate short catalog here made the same numeric id
 * map to a different template than `getStudioTemplate(id)` / the Explorer,
 * so `?template=<id>` links and the featured strip would silently disagree.
 */
export function featuredStudioTemplates(limit = 8): StudioTemplate[] {
  return ensureCatalog()
    .slice(0, Math.max(1, limit))
    .map((t) => ({ ...t, preview_video: "" }));
}

export function categoryCounts(): Record<TemplateCategory | "All", number> {
  const all = ensureCatalog();
  const counts = {
    All: all.length,
    Cinematic: 0,
    Anime: 0,
    VFX: 0,
    Product: 0,
  } as Record<TemplateCategory | "All", number>;
  for (const t of all) {
    const c = t.category as TemplateCategory;
    if (c in counts) counts[c] += 1;
  }
  return counts;
}
