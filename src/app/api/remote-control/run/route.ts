import { NextResponse } from "next/server";

import { assertAutomationRequest } from "@/lib/kingston/automation";
import type { RemoteControlAction, RemoteControlSource } from "@/lib/kingston/contracts";
import { canManageModule } from "@/lib/kingston/helpers";
import {
  createRemoteControlActor,
  getAuthSessionUser,
  runRemoteControlAction
} from "@/lib/kingston/server";
import { assertSameOriginRequest } from "@/lib/request-security";

type RequestPayload = {
  action?: RemoteControlAction;
  source?: RemoteControlSource;
};

function parsePayload(payload: RequestPayload | null | undefined) {
  return {
    action: payload?.action ?? "diagnostico",
    source: payload?.source ?? "api"
  };
}

export async function POST(request: Request) {
  const sessionUser = await getAuthSessionUser();

  if (sessionUser) {
    try {
      assertSameOriginRequest(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Origen no permitido.";
      return NextResponse.json({ message }, { status: 403 });
    }

    if (sessionUser.team !== "ADMIN" && !canManageModule(sessionUser.permissions, "settings")) {
      return NextResponse.json({ message: "No tenes permiso para ejecutar esta accion remota." }, { status: 403 });
    }
  } else {
    try {
      assertAutomationRequest(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No autorizado.";
      return NextResponse.json({ message }, { status: 401 });
    }
  }

  try {
    const payload = parsePayload((await request.json().catch(() => null)) as RequestPayload | null);
    const actor = sessionUser ?? createRemoteControlActor();
    const result = await runRemoteControlAction(actor, payload);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pude ejecutar la accion remota.";
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    return NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
