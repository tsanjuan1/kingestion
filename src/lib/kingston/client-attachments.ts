"use client";

export const CLIENT_ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024;

export function formatClientAttachmentLimit() {
  return `${Math.round(CLIENT_ATTACHMENT_MAX_BYTES / 1024 / 1024)} MB`;
}

export async function uploadCaseAttachmentFile(file: File, caseId?: string) {
  const formData = new FormData();
  formData.append("file", file);
  if (caseId) {
    formData.append("caseId", caseId);
  }

  const response = await fetch("/api/case-attachments", {
    method: "POST",
    credentials: "include",
    body: formData
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "No pude guardar el adjunto.");
  }

  return (await response.json()) as {
    name: string;
    mimeType: string;
    sizeLabel: string;
    previewUrl: string;
  };
}
