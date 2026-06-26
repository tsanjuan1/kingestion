import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSessionUser, getWorkspaceSnapshot, updateCurrentUserProfile } from "@/lib/kingston/server";
import { assertSameOriginRequest } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(180).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().trim().min(8).max(120).optional()
});

export async function PATCH(request: Request) {
  try {
    assertSameOriginRequest(request);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Origen no permitido." }, { status: 403 });
  }

  const currentUser = await getAuthSessionUser();
  if (!currentUser) {
    return NextResponse.json({ message: "Sesion vencida." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const parsed = profileSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Datos invalidos." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    await updateCurrentUserProfile(currentUser.id, parsed.data);
    const snapshot = await getWorkspaceSnapshot(currentUser.id);
    return NextResponse.json({ snapshot }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pude actualizar el perfil.";
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    return NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
