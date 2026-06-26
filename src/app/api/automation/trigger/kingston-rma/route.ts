import { NextResponse } from "next/server";

import { canManageModule } from "@/lib/kingston/helpers";
import { runKingestionNativeAutomation } from "@/lib/kingston/native-automation";
import { getAuthSessionUser } from "@/lib/kingston/server";
import { assertSameOriginRequest } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { message: "Falta configurar CRON_SECRET para ejecutar el cron." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ message: "No autorizado." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const result = await runKingestionNativeAutomation({ source: "cron" });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pude ejecutar la automatizacion nativa.";
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    return NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}

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

  if (currentUser.team !== "ADMIN" && !canManageModule(currentUser.permissions, "settings")) {
    return NextResponse.json(
      { message: "No tenes permiso para ejecutar la automatizacion." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const result = await runKingestionNativeAutomation({ actor: currentUser, source: "manual" });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pude ejecutar la automatizacion.";
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    return NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
