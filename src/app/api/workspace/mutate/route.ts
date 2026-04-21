import { NextResponse } from "next/server";

import type { WorkspaceMutation } from "@/lib/kingston/server";
import { applyWorkspaceMutation, getAuthSessionUser } from "@/lib/kingston/server";

export async function POST(request: Request) {
  const currentUser = await getAuthSessionUser();

  if (!currentUser) {
    return NextResponse.json({ message: "Sesion vencida." }, { status: 401 });
  }

  const mutation = (await request.json()) as WorkspaceMutation;

  try {
    const result = await applyWorkspaceMutation(currentUser.id, mutation);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pude aplicar el cambio solicitado.";
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    return NextResponse.json({ message }, { status });
  }
}
