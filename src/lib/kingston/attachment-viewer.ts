"use client";

import { sanitizePreviewUrl } from "@/lib/kingston/url-safety";

export async function openAttachmentPreview(previewUrl: string) {
  const safePreviewUrl = sanitizePreviewUrl(previewUrl);
  if (!safePreviewUrl) {
    throw new Error("El adjunto tiene una URL no permitida.");
  }

  if ((safePreviewUrl.startsWith("http://") || safePreviewUrl.startsWith("https://")) && !safePreviewUrl.startsWith(window.location.origin)) {
    throw new Error("Por seguridad, solo se pueden abrir adjuntos internos o cargados localmente.");
  }

  const openedWindow = window.open(safePreviewUrl, "_blank", "noopener,noreferrer");

  if (!openedWindow) {
    const fallbackLink = document.createElement("a");
    fallbackLink.href = safePreviewUrl;
    fallbackLink.target = "_blank";
    fallbackLink.rel = "noreferrer";
    fallbackLink.click();
  }
}
