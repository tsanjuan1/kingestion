import { NextResponse } from "next/server";

import { canAccessModule, canManageModule } from "@/lib/kingston/helpers";
import { getAuthSessionUser } from "@/lib/kingston/server";
import type { OwnerDirectoryEntry } from "@/lib/kingston/types";

export async function authorizeMailRequest(options: { manage?: boolean } = {}) {
  const currentUser = await getAuthSessionUser();

  if (!currentUser) {
    return {
      currentUser: null,
      response: NextResponse.json({ message: "Sesion vencida." }, { status: 401, headers: { "Cache-Control": "no-store" } })
    };
  }

  const allowed =
    currentUser.team === "ADMIN" ||
    (options.manage ? canManageModule(currentUser.permissions, "mail") : canAccessModule(currentUser.permissions, "mail"));

  if (!allowed) {
    return {
      currentUser: null,
      response: NextResponse.json(
        { message: "No tenes permisos para acceder al modulo Correo." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      )
    };
  }

  return {
    currentUser,
    response: null
  } as { currentUser: OwnerDirectoryEntry; response: null };
}

export function mailErrorResponse(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message : fallbackMessage;
  return NextResponse.json({ message }, { status: 500, headers: { "Cache-Control": "no-store" } });
}
