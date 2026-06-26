import { NextResponse } from "next/server";

import { authorizeMailRequest, mailErrorResponse } from "@/app/api/mail/_lib";
import { listKingstonMailboxMessages } from "@/lib/kingston/mail";
import { runKingestionNativeAutomation } from "@/lib/kingston/native-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = await authorizeMailRequest();
  if (authorization.response) {
    return authorization.response;
  }

  try {
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "50"), 1), 100);
    const shouldSyncAutomation = url.searchParams.get("syncAutomation") === "true";
    let automationError: string | null = null;

    if (shouldSyncAutomation) {
      try {
        await runKingestionNativeAutomation({
          actor: authorization.currentUser,
          source: "api"
        });
      } catch (error) {
        automationError = error instanceof Error ? error.message : "No pude ejecutar la sincronizacion automatica.";
      }
    }

    const payload = await listKingstonMailboxMessages(limit);

    return NextResponse.json(
      {
        ...payload,
        automationError
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return mailErrorResponse(error, "No pude leer la bandeja de correo Kingston.");
  }
}
