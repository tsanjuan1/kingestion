import { NextResponse } from "next/server";
import { z } from "zod";

import { isModuleOnboardingId, type ModuleOnboardingId } from "@/lib/kingston/onboarding";
import {
  getAuthSessionUser,
  getKingestionSystemSetting,
  upsertKingestionSystemSetting
} from "@/lib/kingston/server";
import { assertSameOriginRequest } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ONBOARDING_NAMESPACE = "USER_MODULE_ONBOARDING";

const moduleIdSchema = z.string().refine(isModuleOnboardingId, "Modulo de ayuda invalido.");

const onboardingSchema = z
  .object({
    moduleId: moduleIdSchema.optional(),
    moduleIds: z.array(moduleIdSchema).optional()
  })
  .refine((data) => Boolean(data.moduleId || data.moduleIds?.length), "No se recibieron modulos para guardar.");

function normalizeSeenModules(value: unknown): ModuleOnboardingId[] {
  const rawModules =
    Array.isArray(value)
      ? value
      : value && typeof value === "object" && "seenModules" in value && Array.isArray(value.seenModules)
        ? value.seenModules
        : [];

  return Array.from(new Set(rawModules.filter(isModuleOnboardingId)));
}

async function getSeenModules(userId: string) {
  const setting = await getKingestionSystemSetting(ONBOARDING_NAMESPACE, userId);
  return normalizeSeenModules(setting?.value_json);
}

export async function GET() {
  const currentUser = await getAuthSessionUser();
  if (!currentUser) {
    return NextResponse.json({ message: "Sesion vencida." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const seenModules = await getSeenModules(currentUser.id);
  return NextResponse.json({ seenModules }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Origen no permitido." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  const currentUser = await getAuthSessionUser();
  if (!currentUser) {
    return NextResponse.json({ message: "Sesion vencida." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const parsed = onboardingSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Datos invalidos." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const requestedModules = parsed.data.moduleIds ?? (parsed.data.moduleId ? [parsed.data.moduleId] : []);
  const seenModules = Array.from(new Set([...await getSeenModules(currentUser.id), ...requestedModules]));

  await upsertKingestionSystemSetting({
    namespace: ONBOARDING_NAMESPACE,
    key: currentUser.id,
    value: {
      seenModules,
      updatedAt: new Date().toISOString()
    },
    description: "Modulos de ayuda visual ya vistos por el usuario."
  });

  return NextResponse.json({ seenModules }, { headers: { "Cache-Control": "no-store" } });
}
