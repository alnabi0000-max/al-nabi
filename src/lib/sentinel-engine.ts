/**
 * ALNABIY-AI-2026: Sentinel Guard, Brand Injector & Self-Healing Core Engine
 * Enterprise-Grade Neural Filtering, Smart Normalizer & Total Zero-Footprint Masking
 */

import { ALNABIY_ENGINES } from "@/lib/models";

export interface ProcessedPromptResult {
  isSafe: boolean;
  rejectionReason?: string;
  /** Brand-tagged segments (Alnabiy_1, …) */
  normalizedPrompts: string[];
  /** Render uchun toza matn (brend prefikssiz) */
  renderPrompt: string;
  brandTag: string;
  sanitizedMetadata: Record<string, string>;
}

export class AlnabiySentinelEngine {
  /** 1. INTENT-BASED NSFW & ETHICS GUARD */
  private static ForbiddenPatterns: RegExp[] = [
    /\b(nsfw|nude|nudity|explicit|porn|porno|hentai|erotic|sex|sexual|topless|unclothed)\b/i,
    /\b(gore|bloody|decapitation|mutilation|dismemberment|suicide|self-harm)\b/i,
    /\b(hate\s*speech|racist|extremism|terrorist)\b/i,
    /\b(jinsiy|erotik|erotika|порн|секс|голый|эротик)\b/i,
  ];

  /** 2. Tashqi prompt formatlarini tozalash (Perchance, MJ, SD) */
  private static LegacyTagPatterns: RegExp[] = [
    /scan_\d+:\s*/gi,
    /prompt::\d+/gi,
    /--v\s+\d+(\.\d+)?/gi,
    /--ar\s+\d+:\d+/gi,
    /--no\s+[\w\s,]+/gi,
    /--stylize\s+\d+/gi,
    /--style\s+[\w-]+/gi,
    /--q\s+\d+/gi,
    /<lora:[^>]+>/gi,
    /<[^:>]+:\d+(\.\d+)?>/gi,
    /\[(\w+|\d+)\]/gi,
  ];

  public static isForbidden(rawPrompt: string): boolean {
    return this.ForbiddenPatterns.some((pattern) => pattern.test(rawPrompt));
  }

  /**
   * Main Pipeline: Safety → Normalize → Brand Injection → Zero-Footprint metadata
   */
  public static processInput(rawPrompt: string): ProcessedPromptResult {
    if (this.isForbidden(rawPrompt)) {
      return {
        isSafe: false,
        rejectionReason:
          "Ushbu so'rov platforma xavfsizlik va etika standartlariga mos kelmaydi.",
        normalizedPrompts: [],
        renderPrompt: "",
        brandTag: "ALNABIY_BLOCKED",
        sanitizedMetadata: {},
      };
    }

    let cleanedPrompt = rawPrompt;
    this.LegacyTagPatterns.forEach((pattern) => {
      cleanedPrompt = cleanedPrompt.replace(pattern, " ");
    });
    cleanedPrompt = cleanedPrompt.replace(/\s+/g, " ").trim();

    if (cleanedPrompt.length < 3) {
      return {
        isSafe: false,
        rejectionReason: "Prompt juda qisqa yoki noto'g'ri formatda.",
        normalizedPrompts: [],
        renderPrompt: "",
        brandTag: "ALNABIY_BLOCKED",
        sanitizedMetadata: {},
      };
    }

    const promptSegments = cleanedPrompt
      .split(/(?:\.|\n|;)+/)
      .filter((seg) => seg.trim().length > 3);

    const finalPrompts: string[] = [];
    if (promptSegments.length <= 1) {
      finalPrompts.push(`Alnabiy_1: ${cleanedPrompt}`);
    } else {
      promptSegments.forEach((segment, index) => {
        finalPrompts.push(`Alnabiy_${index + 1}: ${segment.trim()}`);
      });
    }

    const renderPrompt = finalPrompts
      .map((p) => p.replace(/^Alnabiy_\d+:\s*/i, ""))
      .join(". ")
      .trim();

    const sanitizedMetadata = {
      engine: `${ALNABIY_ENGINES.realism} v2026`,
      signature: "0xALNABIY_SECURE_ENCRYPTED",
      creator: "Alnabiy AI Global Platform",
      brand: "ALNABIY_VIRAL_CORE",
      timestamp: new Date().toISOString(),
    };

    return {
      isSafe: true,
      normalizedPrompts: finalPrompts,
      renderPrompt,
      brandTag: "ALNABIY_VIRAL_CORE",
      sanitizedMetadata,
    };
  }

  /**
   * Self-Healing — asosiy engine uzilsa zaxira marshrut
   */
  public static async executeWithSelfHealing<T>(
    primaryTask: () => Promise<T>,
    fallbackTask: () => Promise<T>
  ): Promise<T> {
    try {
      return await primaryTask();
    } catch (error) {
      console.warn(
        "[Alnabiy Sentinel] Primary engine failure. Self-Healing fallback…"
      );
      try {
        return await fallbackTask();
      } catch {
        throw new Error(
          "[Alnabiy Sentinel] Barcha zaxira serverlarida uzilish. Qayta urinib ko'ring."
        );
      }
    }
  }
}
