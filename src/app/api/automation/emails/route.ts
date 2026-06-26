import { NextResponse } from "next/server";

import { canAccessModule } from "@/lib/kingston/helpers";
import { getAuthSessionUser, getWorkspaceSnapshot, listKingestionEmailHistory } from "@/lib/kingston/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const currentUser = await getAuthSessionUser();

  if (!currentUser) {
    return NextResponse.json({ message: "Sesion vencida." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const url = new URL(request.url);
  const caseId = url.searchParams.get("caseId");
  const canInspectEmails =
    currentUser.team === "ADMIN" ||
    canAccessModule(currentUser.permissions, "audit") ||
    canAccessModule(currentUser.permissions, "mail");
  const canInspectCaseThread = caseId
    ? (await getWorkspaceSnapshot(currentUser.id)).cases.some((entry) => entry.id === caseId)
    : false;

  if (!canInspectEmails && !canInspectCaseThread) {
    return NextResponse.json(
      { message: "No tenes permiso para ver el historial de correos." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "100"), 1), 300);
    const items = await listKingestionEmailHistory(limit, { caseId });
    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No pude cargar el historial de correos." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
