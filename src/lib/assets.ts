/**
 * Secure Media Assets — Prisma ownership + soft owner markers
 */

import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { whiteLabelEngine } from "@/lib/models";
import type { GenerationKind } from "@/lib/credits";
import type { GenerationType } from "@prisma/client";

export type MediaAssetDto = {
  id: string;
  kind: GenerationKind;
  title: string;
  prompt: string | null;
  mediaUrl: string | null;
  durationSec: number;
  emotionMode: string;
  creditsCost: number;
  provider: string | null;
  quality: string | null;
  createdAt: string;
  source: "db" | "local";
};

function storageRoot() {
  return process.env.STORAGE_DIR || "./storage";
}

function kindFromGenerationType(type: GenerationType): GenerationKind {
  if (type === "IMAGE") return "image";
  if (type === "SCRIPT_TO_MOVIE") return "text_to_movie";
  return "prompt_to_video";
}

function generationTypeFromKind(kind: GenerationKind): GenerationType {
  if (kind === "image") return "IMAGE";
  if (kind === "text_to_movie") return "SCRIPT_TO_MOVIE";
  return "TEXT_TO_VIDEO";
}

export async function resolveUserByKey(alnabiyKey?: string | null) {
  if (!alnabiyKey) return null;
  try {
    const db = await prisma.user.findUnique({ where: { alnabiyKey } });
    if (db) return db;
  } catch {
    /* DB offline — soft */
  }
  try {
    const { findUserByKey } = await import("@/lib/auth/local-store");
    const { syncLocalUserToPrisma } = await import("@/lib/auth/sync-local");
    const local = findUserByKey(alnabiyKey);
    if (!local) return null;
    return await syncLocalUserToPrisma(local);
  } catch {
    return null;
  }
}

/** Soft-mode: job papkasiga egasi yozuvi */
export async function writeJobOwnerMarker(
  jobId: string,
  alnabiyKey?: string | null
) {
  if (!alnabiyKey) return;
  const dir = path.join(storageRoot(), "jobs", jobId);
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, ".owner"),
      JSON.stringify({ alnabiyKey, at: new Date().toISOString() }),
      "utf8"
    );
  } catch {
    /* ignore */
  }
}

export async function readJobOwnerMarker(
  jobId: string
): Promise<string | null> {
  try {
    const raw = await fs.readFile(
      path.join(storageRoot(), "jobs", jobId, ".owner"),
      "utf8"
    );
    const data = JSON.parse(raw) as { alnabiyKey?: string };
    return data.alnabiyKey || null;
  } catch {
    return null;
  }
}

/**
 * Media path: jobs/{jobId}/... — faqat egasi
 */
export async function assertMediaAccess(opts: {
  pathParts: string[];
  alnabiyKey?: string | null;
}): Promise<{ ok: boolean; status: number; error?: string }> {
  const { pathParts, alnabiyKey } = opts;
  if (!pathParts.length) {
    return { ok: false, status: 400, error: "Invalid path" };
  }

  // Faqat jobs/ ostidagi fayllar ownership talab qiladi
  if (pathParts[0] !== "jobs") {
    return { ok: true, status: 200 };
  }

  const jobId = pathParts[1];
  if (!jobId || jobId.includes("..")) {
    return { ok: false, status: 400, error: "Invalid job" };
  }

  if (!alnabiyKey) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const user = await resolveUserByKey(alnabiyKey);
  if (user) {
    try {
      const generation = await prisma.generation.findFirst({
        where: { id: jobId, userId: user.id, deletedAt: null },
        select: { id: true },
      });
      if (generation) return { ok: true, status: 200 };
    } catch {
      /* soft marker */
    }
  }

  const owner = await readJobOwnerMarker(jobId);
  if (owner && owner === alnabiyKey) {
    return { ok: true, status: 200 };
  }

  return { ok: false, status: 403, error: "Forbidden" };
}

export async function persistJobAsset(opts: {
  jobId: string;
  alnabiyKey?: string | null;
  kind: GenerationKind;
  prompt?: string | null;
  enhancedPrompt?: string | null;
  script?: string | null;
  resultUrl?: string | null;
  durationSec?: number;
  emotionMode?: string;
  style?: string;
  quality?: string;
  provider?: string;
  cameraMove?: string;
  creditsCost?: number;
  identityLocked?: boolean;
}): Promise<MediaAssetDto | null> {
  await writeJobOwnerMarker(opts.jobId, opts.alnabiyKey);
  const user = await resolveUserByKey(opts.alnabiyKey);
  if (!user) return null;

  try {
    const generation = await prisma.generation.upsert({
      where: { id: opts.jobId },
      create: {
        id: opts.jobId,
        userId: user.id,
        type: generationTypeFromKind(opts.kind),
        status: "COMPLETED",
        prompt: opts.prompt || null,
        enhancedPrompt: opts.enhancedPrompt || null,
        script: opts.script || null,
        resultUrl: opts.resultUrl || null,
        durationSec: opts.durationSec ?? 8,
        emotionMode: opts.emotionMode || "neutral",
        style: opts.style || null,
        quality: opts.quality || "1080p",
        provider: opts.provider || null,
        cameraMove: opts.cameraMove || null,
        creditsCost: opts.creditsCost || 0,
        identityLocked: opts.identityLocked || false,
      },
      update: {
        status: "COMPLETED",
        resultUrl: opts.resultUrl || undefined,
        enhancedPrompt: opts.enhancedPrompt || undefined,
        creditsCost: opts.creditsCost,
        deletedAt: null,
      },
    });

    return {
      id: generation.id,
      kind: kindFromGenerationType(generation.type),
      title: (generation.prompt || generation.script || "Alnabiy").slice(0, 80),
      prompt: generation.prompt || generation.script,
      mediaUrl: generation.resultUrl,
      durationSec: generation.durationSec,
      emotionMode: generation.emotionMode || "neutral",
      creditsCost: generation.creditsCost,
      provider: whiteLabelEngine(generation.provider),
      quality: generation.quality,
      createdAt: generation.createdAt.toISOString(),
      source: "db",
    };
  } catch (e) {
    console.warn("[Alnabiy] persistJobAsset failed", e);
    return null;
  }
}

export async function listUserAssets(
  alnabiyKey?: string | null
): Promise<MediaAssetDto[]> {
  const user = await resolveUserByKey(alnabiyKey);
  if (!user) return [];

  try {
    const generations = await prisma.generation.findMany({
      where: { userId: user.id, deletedAt: null, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      take: 120,
    });
    return generations.map((generation) => ({
      id: generation.id,
      kind: kindFromGenerationType(generation.type),
      title: (generation.prompt || generation.script || "Alnabiy").slice(0, 80),
      prompt: generation.prompt || generation.script,
      mediaUrl: generation.resultUrl,
      durationSec: generation.durationSec,
      emotionMode: generation.emotionMode || "neutral",
      creditsCost: generation.creditsCost,
      provider: whiteLabelEngine(generation.provider),
      quality: generation.quality,
      createdAt: generation.createdAt.toISOString(),
      source: "db" as const,
    }));
  } catch {
    return [];
  }
}

export async function softDeleteAsset(
  assetId: string,
  alnabiyKey?: string | null
): Promise<{ ok: boolean; code?: string }> {
  const user = await resolveUserByKey(alnabiyKey);
  if (!user) {
    // Soft: faqat owner marker bo'lsa local delete
    const owner = await readJobOwnerMarker(assetId);
    if (owner && owner === alnabiyKey) {
      try {
        await fs.writeFile(
          path.join(storageRoot(), "jobs", assetId, ".deleted"),
          "1",
          "utf8"
        );
      } catch {}
      return { ok: true };
    }
    return { ok: false, code: "UNAUTHORIZED" };
  }

  try {
    const generation = await prisma.generation.findFirst({
      where: { id: assetId, userId: user.id, deletedAt: null },
    });
    if (!generation) return { ok: false, code: "NOT_FOUND" };
    await prisma.generation.update({
      where: { id: generation.id },
      data: { deletedAt: new Date() },
    });
    return { ok: true };
  } catch {
    return { ok: false, code: "ERROR" };
  }
}

export async function getUserBalanceStats(alnabiyKey?: string | null): Promise<{
  coins: number | null;
  totalSpent: number;
  totalEarned: number;
  assetCount: number;
  email: string | null;
  plan: string | null;
}> {
  const empty = {
    coins: null as number | null,
    totalSpent: 0,
    totalEarned: 0,
    assetCount: 0,
    email: null as string | null,
    plan: null as string | null,
  };

  const user = await resolveUserByKey(alnabiyKey);
  if (!user) return empty;

  try {
    const [spentAgg, earnedAgg, assetCount] = await Promise.all([
      prisma.coinLedger.aggregate({
        where: { userId: user.id, delta: { lt: 0 } },
        _sum: { delta: true },
      }),
      prisma.coinLedger.aggregate({
        where: { userId: user.id, delta: { gt: 0 } },
        _sum: { delta: true },
      }),
      prisma.generation.count({
        where: { userId: user.id, deletedAt: null, status: "COMPLETED" },
      }),
    ]);

    return {
      coins: user.coins,
      totalSpent: Math.abs(spentAgg._sum.delta || 0),
      totalEarned: earnedAgg._sum.delta || 0,
      assetCount,
      email: user.email,
      plan: user.plan,
    };
  } catch {
    return { ...empty, coins: user.coins, email: user.email, plan: user.plan };
  }
}
