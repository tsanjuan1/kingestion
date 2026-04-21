import { NextResponse } from "next/server";

import { getAuthSessionUser, getWorkspaceSnapshot } from "@/lib/kingston/server";

export async function GET() {
  const currentUser = await getAuthSessionUser();

  if (!currentUser) {
    return NextResponse.json({ message: "Sesion vencida." }, { status: 401 });
  }

  try {
    const snapshot = await getWorkspaceSnapshot(currentUser.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pude cargar el workspace.";
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    return NextResponse.json({ message }, { status });
  }
}
