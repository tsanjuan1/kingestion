import { NextResponse } from "next/server";

import { authorizeMailRequest, mailErrorResponse } from "@/app/api/mail/_lib";
import { getKingstonMailboxAttachment } from "@/lib/kingston/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ uid: string; index: string }>;
};

function encodeDownloadName(name: string) {
  return encodeURIComponent(name).replace(/['()]/g, escape).replace(/\*/g, "%2A");
}

export async function GET(_request: Request, context: RouteContext) {
  const authorization = await authorizeMailRequest();
  if (authorization.response) {
    return authorization.response;
  }

  try {
    const { uid: rawUid, index: rawIndex } = await context.params;
    const uid = rawUid.trim();
    const index = Number(rawIndex);

    if (!uid || !Number.isInteger(index) || index < 0) {
      return NextResponse.json({ message: "Adjunto invalido." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    const attachment = await getKingstonMailboxAttachment(uid, index);
    if (!attachment) {
      return NextResponse.json({ message: "No encontre el adjunto solicitado." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    }

    return new Response(new Uint8Array(attachment.content), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": attachment.mimeType,
        "X-Content-Type-Options": "nosniff",
        "Content-Length": String(attachment.content.byteLength),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeDownloadName(attachment.name)}`
      }
    });
  } catch (error) {
    return mailErrorResponse(error, "No pude descargar el adjunto.");
  }
}
