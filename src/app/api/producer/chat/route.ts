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
import { loadInterestProfilePromptBlock } from "@/lib/producer/interest-profile";
import { loadRecentWorkPromptBlock } from "@/lib/producer/recent-work";

/** Build a compact account snapshot for the Producer Chat system prompt. */
async function buildClientContext(userId: string, coins: number): Promise<string> {
  try {
    const [user, totalProjects, styleRows, interestBlock, recentWorkBlock] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        }),
        prisma.generation.count({
          where: { userId, deletedAt: null },
        }),
        prisma.generation.findMany({
          where: { userId, deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 40,
          select: { style: true },
        }),
        loadInterestProfilePromptBlock(userId),
        loadRecentWorkPromptBlock(userId, 3),
      ]);

    const displayName = (user?.name || "").trim();
    const templates = [
      ...new Set(
        styleRows
          .map((g) => (g.style || "").trim())
          .filter(Boolean)
      ),
    ];

    return [
      `- Ism: ${displayName || "noma'lum"}`,
      `- Kredit qolgan (NC): ${coins}`,
      `- Jami video/loyihalar: ${totalProjects}`,
      `- Foydalanilgan shablonlar/uslublar: ${templates.length ? templates.join(", ") : "hali yo‘q"}`,
      recentWorkBlock
        ? `Oxirgi ishlar (ICHKI — har safar aytib berma; faqat "davom ettiraylik" / shunga oid savolda tabiiy ishlat):\n${recentWorkBlock}`
        : `- Oxirgi ishlar: hali yo‘q`,
      interestBlock
        ? `Ijodiy qiziqish profili (ICHKI — ovoz chiqarib o‘qima; faqat tabiiy tavsiya uchun):\n${interestBlock}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");
  } catch {
    return [
      `- Ism: noma'lum`,
      `- Kredit qolgan (NC): ${coins}`,
      `- Jami video/loyihalar: noma'lum (DB vaqtincha mavjud emas)`,
      `- Oxirgi ishlar: noma'lum`,
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
