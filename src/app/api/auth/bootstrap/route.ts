import { NextResponse } from "next/server";
import { z } from "zod";

import { assertRateLimit, bootstrapAdminUser } from "@/lib/kingston/server";
import { assertSameOriginRequest, getRequestClientKey } from "@/lib/request-security";

const bootstrapSchema = z
  .object({
    name: z.string().trim().min(1),
    email: z.string().trim().email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8)
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Las contrasenas no coinciden.",
    path: ["confirmPassword"]
  });

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Origen no permitido." }, { status: 403 });
  }

  const parsed = bootstrapSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Revisa los datos." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    await assertRateLimit("auth-bootstrap", getRequestClientKey(request, parsed.data.email.trim().toLowerCase()), 3, 60 * 60 * 1000);
    const user = await bootstrapAdminUser(parsed.data);
    return NextResponse.json({ user }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pude crear el administrador.";
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    return NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
