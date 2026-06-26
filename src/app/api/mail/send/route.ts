import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizeMailRequest, mailErrorResponse } from "@/app/api/mail/_lib";
import { sendKingestionEmail } from "@/lib/kingston/mail";
import { assertRateLimit } from "@/lib/kingston/server";
import { assertSameOriginRequest, getRequestClientKey } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sendMailSchema = z.object({
  to: z.string().trim().email(),
  cc: z.string().trim().optional().default(""),
  subject: z.string().trim().min(1, "El asunto es obligatorio."),
  body: z.string().trim().min(1, "Escribi un mensaje antes de enviar.")
});

export async function POST(request: Request) {
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
    await assertRateLimit("mail-send", `${authorization.currentUser.id}|${getRequestClientKey(request)}`, 40, 60 * 60 * 1000);
    const payload = sendMailSchema.parse(await request.json());
    const result = await sendKingestionEmail({
      to: payload.to,
      cc: payload.cc || undefined,
      subject: payload.subject,
      text: payload.body
    });

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          message: "El correo no es valido.",
          issues: z.treeifyError(error)
        },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    return mailErrorResponse(error, "No pude enviar el correo.");
  }
}
