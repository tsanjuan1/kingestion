import { NextResponse } from "next/server";
import { z } from "zod";

import { loginWithCredentials } from "@/lib/kingston/server";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ message: "Completa email y contrasena correctamente." }, { status: 400 });
  }

  try {
    const user = await loginWithCredentials(parsed.data.email, parsed.data.password);

    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pude iniciar sesion.";
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    return NextResponse.json({ message }, { status });
  }
}
