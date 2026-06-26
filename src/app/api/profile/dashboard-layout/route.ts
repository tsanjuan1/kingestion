import { NextResponse } from "next/server";
import { z } from "zod";

import {
  normalizeDashboardLayoutPreference,
  type DashboardLayoutPreference
} from "@/lib/kingston/dashboard-layout";
import {
  getAuthSessionUser,
  getKingestionSystemSetting,
  upsertKingestionSystemSetting
} from "@/lib/kingston/server";
import { assertSameOriginRequest } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DASHBOARD_LAYOUT_NAMESPACE = "USER_DASHBOARD_LAYOUT";

const dashboardLayoutSchema = z.object({
  order: z.array(z.string()).optional(),
  hidden: z.array(z.string()).optional()
});

async function getUserDashboardLayout(userId: string) {
  const setting = await getKingestionSystemSetting(DASHBOARD_LAYOUT_NAMESPACE, userId);
  return normalizeDashboardLayoutPreference(setting?.value_json);
}

export async function GET() {
  const currentUser = await getAuthSessionUser();
  if (!currentUser) {
    return NextResponse.json({ message: "Sesion vencida." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const layout = await getUserDashboardLayout(currentUser.id);
  return NextResponse.json({ layout }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
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

  const parsed = dashboardLayoutSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Preferencia invalida." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const layout: DashboardLayoutPreference = normalizeDashboardLayoutPreference(parsed.data);

  await upsertKingestionSystemSetting({
    namespace: DASHBOARD_LAYOUT_NAMESPACE,
    key: currentUser.id,
    value: {
      ...layout,
      updatedAt: new Date().toISOString()
    },
    description: "Layout personalizado del dashboard resumen por usuario."
  });

  return NextResponse.json({ layout }, { headers: { "Cache-Control": "no-store" } });
}
