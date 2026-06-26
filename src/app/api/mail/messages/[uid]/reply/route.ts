import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizeMailRequest, mailErrorResponse } from "@/app/api/mail/_lib";
import { replyToKingstonMailboxMessage } from "@/lib/kingston/mail";
import { assertRateLimit } from "@/lib/kingston/server";
import { assertSameOriginRequest, getRequestClientKey } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ uid: string }>;
};

const replySchema = z.object({
  to: z.string().trim().email(),
  cc: z.string().trim().optional().default(""),
  body: z.string().trim().min(1, "Escribi una respuesta antes de enviar.")
});

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSameOriginRequest(request);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Origen no permitido." }, { status: 403 });
  }

  const authorization = await authorizeMailRequest({ manage: true });
  if (authorization.response) {
    return authorization.response;
  }

  try {
    await assertRateLimit("mail-reply", `${authorization.currentUser.id}|${getRequestClientKey(request)}`, 40, 60 * 60 * 1000);
    const { uid: rawUid } = await context.params;
    const uid = rawUid.trim();

    if (!uid) {
      return NextResponse.json({ message: "UID de correo invalido." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    const payload = replySchema.parse(await request.json());
    const result = await replyToKingstonMailboxMessage(uid, payload);

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          message: "La respuesta no es valida.",
          issues: z.treeifyError(error)
        },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    return mailErrorResponse(error, "No pude enviar la respuesta.");
  }
}
