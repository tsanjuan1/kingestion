import { NextResponse } from "next/server";

import { runKingestionNativeAutomation } from "@/lib/kingston/native-automation";
import { getAuthSessionUser, getKingestionAutomationCloudStatus } from "@/lib/kingston/server";
import { assertSameOriginRequest } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Origen no permitido." }, { status: 403 });
  }

  const currentUser = await getAuthSessionUser();
  if (!currentUser) {
    return NextResponse.json({ message: "Sesion vencida." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const status = await getKingestionAutomationCloudStatus();
    if (status.control.paused) {
      return NextResponse.json(
        {
          ok: true,
          skipped: true,
          paused: true,
          lastRunAt: status.lastRunAt ?? null
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const result = await runKingestionNativeAutomation({ actor: currentUser, source: "api" });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pude ejecutar el heartbeat de automatizacion.";
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    return NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
