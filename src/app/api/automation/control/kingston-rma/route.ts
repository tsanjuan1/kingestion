import { NextResponse } from "next/server";
import { z } from "zod";

import { canManageModule } from "@/lib/kingston/helpers";
import {
  getAuthSessionUser,
  getKingestionAutomationCloudStatus,
  setKingestionAutomationPaused
} from "@/lib/kingston/server";
import { assertSameOriginRequest } from "@/lib/request-security";

const controlPayloadSchema = z.object({
  paused: z.boolean()
});

export async function GET() {
  const currentUser = await getAuthSessionUser();

  if (!currentUser) {
    return NextResponse.json({ message: "Sesion vencida." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const status = await getKingestionAutomationCloudStatus();
    return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pude cargar el estado de automatizacion.";
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
      { message: "No tenes permiso para administrar la automatizacion." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const payload = controlPayloadSchema.parse(await request.json());
    await setKingestionAutomationPaused({
      paused: payload.paused,
      actor: currentUser
    });
    const status = await getKingestionAutomationCloudStatus();
    return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "El payload de control no es valido.", issues: z.treeifyError(error) },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const message = error instanceof Error ? error.message : "No pude actualizar el estado de automatizacion.";
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    return NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
