import { NextResponse } from "next/server";

import { assertAutomationRequest } from "@/lib/kingston/automation";

export function authorizeAutomationRequest(request: Request) {
  try {
    assertAutomationRequest(request);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "No autorizado.";
    return NextResponse.json({ message }, { status: 401 });
  }
}

export function automationErrorResponse(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message : fallbackMessage;
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;

  return NextResponse.json({ message }, { status });
}
