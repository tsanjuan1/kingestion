import { NextResponse } from "next/server";
import { z } from "zod";

import { assertRateLimit, loginWithCredentials } from "@/lib/kingston/server";
import { assertSameOriginRequest, getRequestClientKey } from "@/lib/request-security";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Origen no permitido." }, { status: 403 });
  }

  const parsed = loginSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Completa email y contrasena correctamente." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    await assertRateLimit("auth-login", getRequestClientKey(request, parsed.data.email.trim().toLowerCase()), 10, 15 * 60 * 1000);
    const user = await loginWithCredentials(parsed.data.email, parsed.data.password);

    return NextResponse.json({ user }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pude iniciar sesion.";
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    return NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
