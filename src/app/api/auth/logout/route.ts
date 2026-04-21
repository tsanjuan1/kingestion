import { NextResponse } from "next/server";

import { logoutCurrentSession } from "@/lib/kingston/server";

export async function POST() {
  await logoutCurrentSession();
  return NextResponse.json({ ok: true });
}
