import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiJson } from "@/lib/api/json-response";
import { runProducerChat } from "@/lib/producer/chat";
import { analyzeVisualDna, type VisualDna } from "@/lib/producer/vision-dna";
import {
  loadProducerMemory,
  saveProducerMemory,
} from "@/lib/producer/memory";
import { guardSensitiveRequest } from "@/lib/security/request-guard";
import { resolveLocale } from "@/lib/i18n/messages";
import {
  ensureRequestLedgerUser,
  isSoftAuthEnabled,
} from "@/lib/auth/ensure-request-user";
import { prisma } from "@/lib/prisma";

/** Build a compact account snapshot for the Producer Chat system prompt. */
async function buildClientContext(userId: string, coins: number): Promise<string> {
  try {
    const [totalProjects, recent] = await Promise.all([
      prisma.generation.count({
        where: { userId, deletedAt: null },
      }),
      prisma.generation.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: {
          type: true,
          status: true,
          style: true,
          prompt: true,
          script: true,
          createdAt: true,
        },
      }),
    ]);

    const lastFive = recent.slice(0, 5).map((g, i) => {
      const title = (g.prompt || g.script || "—").replace(/\s+/g, " ").trim().slice(0, 72);
      const when = g.createdAt.toISOString().slice(0, 10);
      return `${i + 1}) [${g.type}/${g.status}] style=${g.style || "—"} · ${when} · "${title}"`;
    });

    const templates = [
      ...new Set(
        recent
          .map((g) => (g.style || "").trim())
          .filter(Boolean)
      ),
    ];

    return [
      `- Kredit qolgan (NC): ${coins}`,
      `- Jami video/loyihalar: ${totalProjects}`,
      `- Oxirgi 5 ta loyiha: ${lastFive.length ? lastFive.join(" | ") : "hali yo‘q"}`,
      `- Foydalanilgan shablonlar/uslublar: ${templates.length ? templates.join(", ") : "hali yo‘q"}`,
    ].join("\n");
  } catch {
    return [
      `- Kredit qolgan (NC): ${coins}`,
      `- Jami video/loyihalar: noma'lum (DB vaqtincha mavjud emas)`,
      `- Oxirgi 5 ta loyiha: noma'lum`,
      `- Foydalanilgan shablonlar/uslublar: noma'lum`,
    ].join("\n");
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
        imageUrl: z.string().optional().nullable(),
      })
    )
    .min(1)
    .max(24),
  visualDna: z.any().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  locale: z.string().optional(),
  userLevel: z.enum(["beginner", "advanced"]).optional(),
  memoryKey: z.string().optional(),
  preferredAspect: z.enum(["16:9", "9:16", "1:1"]).optional(),
  preferredNarration: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const blocked = await guardSensitiveRequest(req);
    if (blocked) return blocked;

    const ensured = await ensureRequestLedgerUser({
      alnabiyKey: req.headers.get("x-alnabiy-key"),
      allowGuest: isSoftAuthEnabled(),
    });
    if (!ensured) {
      return apiError("Sign in required", {
        status: 401,
        code: "AUTH_REQUIRED",
      });
    }

    const body = schema.parse(await req.json());
    const localeCode = resolveLocale(
      body.locale,
      req.headers.get("x-alnabiy-locale"),
      req.cookies.get("alnabiy_locale")?.value
    );
    const localeName =
      localeCode === "uz"
        ? "Uzbek"
        : localeCode === "ru"
          ? "Russian"
          : "English";

    let dna = (body.visualDna as VisualDna | null) || null;
    const latestImage =
      body.imageUrl ||
      [...body.messages].reverse().find((m) => m.imageUrl)?.imageUrl;

    if (latestImage && !dna) {
      dna = await analyzeVisualDna({
        imageUrl: latestImage,
        locale: localeName,
        userLevel: body.userLevel,
      });
    }

    const memKey =
      body.memoryKey ||
      req.headers.get("x-alnabiy-key") ||
      "guest";
    const memory = await loadProducerMemory(memKey);
    const clientContext = await buildClientContext(
      ensured.user.id,
      ensured.user.coins
    );

    const result = await runProducerChat({
      messages: body.messages,
      visualDna: dna,
      memory,
      locale: localeName,
      localeCode,
      userLevel: body.userLevel,
      clientContext,
    });

    const lastUser = [...body.messages]
      .reverse()
      .find((m) => m.role === "user");
    if (lastUser || result.productionBrief) {
      await saveProducerMemory(memKey, {
        preferredAspect:
          body.preferredAspect ||
          result.suggestedAspect ||
          memory.preferredAspect,
        preferredNarration:
          body.preferredNarration ||
          result.suggestedNarration ||
          memory.preferredNarration,
        preferredStyles: dna?.artStyle ? [dna.artStyle] : [],
        visualTone: dna?.mood || memory.visualTone,
        recentBriefs: [
          result.productionBrief || lastUser?.content || "",
        ].filter(Boolean),
      });
    }

    return apiJson({
      success: true,
      ok: true,
      ...result,
      visualDna: dna,
      currency: "NC",
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Chat failed", {
      status: 400,
      code: "CHAT_FAILED",
    });
  }
}
