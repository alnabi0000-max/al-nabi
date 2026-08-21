import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiJson, formatRouteError } from "@/lib/api/json-response";
import {
  hasCredentialInQuery,
  requireProjectUser,
} from "@/lib/projects/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createProjectSchema = z.object({
  title: z.string().trim().min(1).max(120),
  brief: z.string().trim().max(8_000).optional().nullable(),
  aspect: z.enum(["16:9", "9:16", "1:1"]).optional(),
  spendCapNc: z.number().int().min(1).max(1_000_000).optional().nullable(),
});

/** List only the caller's projects; no cross-user project discovery. */
export async function GET(req: NextRequest) {
  try {
    if (hasCredentialInQuery(req)) {
      return apiError("Credentials in URL query parameters are not accepted.", {
        status: 400,
        code: "CREDENTIAL_IN_URL",
      });
    }
    const authenticated = await requireProjectUser(req);
    if (!authenticated) {
      return apiError("Unauthorized", { status: 401, code: "UNAUTHORIZED" });
    }

    const projects = await prisma.project.findMany({
      where: { userId: authenticated.user.id },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        brief: true,
        aspect: true,
        status: true,
        spendCapNc: true,
        spentNc: true,
        reservedNc: true,
        updatedAt: true,
        _count: { select: { shots: true, renderVersions: true, assets: true } },
      },
    });
    return apiJson({ projects });
  } catch (error) {
    const formatted = formatRouteError(error);
    return apiError(formatted.message, {
      status: formatted.status,
      code: formatted.code,
    });
  }
}

/** Create a blank project; shots and assets are added through scoped routes. */
export async function POST(req: NextRequest) {
  try {
    if (hasCredentialInQuery(req)) {
      return apiError("Credentials in URL query parameters are not accepted.", {
        status: 400,
        code: "CREDENTIAL_IN_URL",
      });
    }
    const authenticated = await requireProjectUser(req);
    if (!authenticated) {
      return apiError("Unauthorized", { status: 401, code: "UNAUTHORIZED" });
    }
    const body = createProjectSchema.parse(await req.json());
    const project = await prisma.project.create({
      data: {
        userId: authenticated.user.id,
        title: body.title,
        brief: body.brief || null,
        aspect: body.aspect || "16:9",
        spendCapNc: body.spendCapNc || null,
      },
    });
    return apiJson({ project }, { status: 201 });
  } catch (error) {
    const formatted = formatRouteError(error);
    return apiError(formatted.message, {
      status: formatted.status,
      code: formatted.code,
    });
  }
}
