import { NextResponse } from "next/server";

import { authorizeAutomationRequest, automationErrorResponse } from "@/app/api/integrations/n8n/_lib";
import { getAutomationActivity } from "@/lib/kingston/server";

export async function GET(request: Request) {
  const unauthorizedResponse = authorizeAutomationRequest(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const url = new URL(request.url);
    const activity = await getAutomationActivity({
      since: url.searchParams.get("since") ?? undefined,
      action: url.searchParams.get("action") ?? undefined,
      entityType: (url.searchParams.get("entityType") as "case" | "owner" | "session" | "report" | "user" | null) ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined
    });

    return NextResponse.json({
      count: activity.length,
      items: activity
    });
  } catch (error) {
    return automationErrorResponse(error, "No pude devolver la actividad de automatizacion.");
  }
}
