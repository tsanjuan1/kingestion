import { NextResponse } from "next/server";

import { logoutCurrentSession } from "@/lib/kingston/server";
import { assertSameOriginRequest } from "@/lib/request-security";

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Origen no permitido." }, { status: 403 });
  }

  await logoutCurrentSession();
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
