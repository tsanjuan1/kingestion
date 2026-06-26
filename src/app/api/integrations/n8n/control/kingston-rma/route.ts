import { NextResponse } from "next/server";

import { authorizeAutomationRequest, automationErrorResponse } from "@/app/api/integrations/n8n/_lib";
import { getKingestionAutomationCloudStatus } from "@/lib/kingston/server";

export async function GET(request: Request) {
  const unauthorizedResponse = authorizeAutomationRequest(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const status = await getKingestionAutomationCloudStatus();
    return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return automationErrorResponse(error, "No pude devolver el control cloud de Kingestion.");
  }
}
