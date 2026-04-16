import { NextResponse } from "next/server";

import { contactSchema } from "@/lib/contact-schema";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "La solicitud no tiene un JSON valido." }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Revisa los datos enviados e intenta nuevamente.",
        issues: parsed.error.flatten().fieldErrors
      },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("contact_requests").insert({
      name: parsed.data.name,
      email: parsed.data.email,
      company: parsed.data.company || null,
      phone: parsed.data.phone || null,
      team_size: parsed.data.teamSize || null,
      interest: parsed.data.interest,
      challenge: parsed.data.challenge,
      source: "website"
    });

    if (error) {
      throw error;
    }

    return NextResponse.json(
      { message: "Perfecto. La consulta ya quedo registrada en Kingestion." },
      { status: 201 }
    );
  } catch (error) {
    console.error("kingestion-contact", error);

    return NextResponse.json(
      { message: "No pudimos guardar tu consulta en este momento." },
      { status: 500 }
    );
  }
}
