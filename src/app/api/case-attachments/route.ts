import { NextResponse } from "next/server";

import { canManageModule } from "@/lib/kingston/helpers";
import {
  assertRateLimit,
  getAuthSessionUser,
  getWorkspaceSnapshot,
  saveKingestionAttachmentBlob
} from "@/lib/kingston/server";
import { assertSameOriginRequest, getRequestClientKey } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatUploadSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function isFormFile(value: FormDataEntryValue | null): value is File {
  return Boolean(value && typeof value === "object" && "arrayBuffer" in value && "name" in value);
}

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Origen no permitido." }, { status: 403 });
  }

  const currentUser = await getAuthSessionUser();
  if (!currentUser) {
    return NextResponse.json({ message: "Sesion vencida." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  if (currentUser.team !== "ADMIN" && !canManageModule(currentUser.permissions, "open-cases")) {
    return NextResponse.json(
      { message: "No tenes permiso para cargar adjuntos." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    await assertRateLimit(
      "case-attachment-upload",
      `${currentUser.id}|${getRequestClientKey(request)}`,
      30,
      10 * 60 * 1000
    );

    const formData = await request.formData();
    const file = formData.get("file");
    const rawCaseId = formData.get("caseId");
    const caseId = typeof rawCaseId === "string" && rawCaseId.trim() ? rawCaseId.trim() : null;

    if (!isFormFile(file) || file.size <= 0) {
      return NextResponse.json(
        { message: "Adjunto invalido o vacio." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (caseId) {
      const snapshot = await getWorkspaceSnapshot(currentUser.id);
      const canSeeCase = snapshot.cases.some((entry) => entry.id === caseId);
      if (!canSeeCase) {
        return NextResponse.json(
          { message: "No tenes permiso para adjuntar archivos a este caso." },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    const content = Buffer.from(await file.arrayBuffer());
    const stored = await saveKingestionAttachmentBlob({
      caseId,
      uploadedByUserId: currentUser.id,
      name: file.name || "adjunto",
      mimeType: file.type || "application/octet-stream",
      content
    });

    return NextResponse.json(
      {
        name: file.name || "adjunto",
        mimeType: file.type || "application/octet-stream",
        sizeLabel: formatUploadSize(file.size),
        previewUrl: stored.previewUrl
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pude guardar el adjunto.";
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    return NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
