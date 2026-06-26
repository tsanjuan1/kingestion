import { NextResponse } from "next/server";

import { authorizeMailRequest, mailErrorResponse } from "@/app/api/mail/_lib";
import { getKingstonMailboxMessage } from "@/lib/kingston/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ uid: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const authorization = await authorizeMailRequest();
  if (authorization.response) {
    return authorization.response;
  }

  try {
    const { uid: rawUid } = await context.params;
    const uid = rawUid.trim();

    if (!uid) {
      return NextResponse.json({ message: "UID de correo invalido." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    const item = await getKingstonMailboxMessage(uid);
    if (!item) {
      return NextResponse.json({ message: "No encontre el correo solicitado." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json({ item }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return mailErrorResponse(error, "No pude abrir el correo solicitado.");
  }
}
