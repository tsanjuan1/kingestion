import { NextResponse } from "next/server";

import {
  getAuthSessionUser,
  getKingestionAttachmentBlob,
  getWorkspaceSnapshot
} from "@/lib/kingston/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ blobId: string }>;
};

function encodeDownloadName(name: string) {
  return encodeURIComponent(name).replace(/['()]/g, escape).replace(/\*/g, "%2A");
}

const INLINE_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/bmp"]);

function isInlineMimeType(mimeType: string) {
  const normalizedMimeType = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
  return (
    INLINE_IMAGE_MIME_TYPES.has(normalizedMimeType) ||
    normalizedMimeType === "application/pdf" ||
    normalizedMimeType === "text/plain" ||
    normalizedMimeType === "text/csv"
  );
}

export async function GET(request: Request, context: RouteContext) {
  const currentUser = await getAuthSessionUser();
  if (!currentUser) {
    return NextResponse.json({ message: "Sesion vencida." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const { blobId } = await context.params;
  if (!blobId || !/^blob-[a-f0-9]+$/i.test(blobId)) {
    return NextResponse.json({ message: "Adjunto invalido." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const attachment = await getKingestionAttachmentBlob(blobId);
  if (!attachment) {
    return NextResponse.json({ message: "No encontre el adjunto solicitado." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  if (attachment.caseId) {
    const snapshot = await getWorkspaceSnapshot(currentUser.id);
    const canSeeCase = snapshot.cases.some((entry) => entry.id === attachment.caseId);
    if (!canSeeCase) {
      return NextResponse.json({ message: "No tenes permiso para abrir este adjunto." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
  } else if (attachment.uploadedByUserId && attachment.uploadedByUserId !== currentUser.id) {
    return NextResponse.json(
      { message: "No tenes permiso para abrir este adjunto." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  const url = new URL(request.url);
  const shouldDownload = url.searchParams.get("download") === "1";
  const disposition = !shouldDownload && isInlineMimeType(attachment.mimeType) ? "inline" : "attachment";
  return new Response(new Uint8Array(attachment.content), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": attachment.mimeType,
      "X-Content-Type-Options": "nosniff",
      "Content-Length": String(attachment.sizeBytes),
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeDownloadName(attachment.name)}`
    }
  });
}
