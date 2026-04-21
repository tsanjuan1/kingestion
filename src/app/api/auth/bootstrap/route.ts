import { NextResponse } from "next/server";
import { z } from "zod";

import { bootstrapAdminUser } from "@/lib/kingston/server";

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
  const parsed = bootstrapSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Revisa los datos." }, { status: 400 });
  }

  try {
    const user = await bootstrapAdminUser(parsed.data);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pude crear el administrador.";
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    return NextResponse.json({ message }, { status });
  }
}
