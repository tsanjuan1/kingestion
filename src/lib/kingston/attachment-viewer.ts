"use client";

export async function openAttachmentPreview(previewUrl: string) {
  try {
    const response = await fetch(previewUrl);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const openedWindow = window.open(blobUrl, "_blank", "noopener,noreferrer");

    if (!openedWindow) {
      const fallbackLink = document.createElement("a");
      fallbackLink.href = blobUrl;
      fallbackLink.target = "_blank";
      fallbackLink.rel = "noreferrer";
      fallbackLink.click();
    }

    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch {
    window.open(previewUrl, "_blank", "noopener,noreferrer");
  }
}
