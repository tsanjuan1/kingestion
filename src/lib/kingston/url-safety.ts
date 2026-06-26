const SAFE_DATA_PREVIEW_PATTERN = /^data:(image\/(?:png|jpe?g|gif|webp|heic|bmp)|application\/pdf);base64,/i;
const SAFE_TRACKING_PROTOCOLS = new Set(["http:", "https:"]);
const SAFE_PREVIEW_PATH_PREFIXES = ["/api/case-attachments/", "/api/mail/messages/"];

function normalizePathUrl(value: string) {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return undefined;
  }

  if (!SAFE_PREVIEW_PATH_PREFIXES.some((prefix) => value.startsWith(prefix))) {
    return undefined;
  }

  return value.length <= 4096 ? value : undefined;
}

export function sanitizePreviewUrl(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return undefined;
  }

  const pathUrl = normalizePathUrl(trimmedValue);
  if (pathUrl) {
    return pathUrl;
  }

  if (SAFE_DATA_PREVIEW_PATTERN.test(trimmedValue)) {
    return trimmedValue.length <= 4096 ? trimmedValue : undefined;
  }

  try {
    const parsed = new URL(trimmedValue);
    if (parsed.protocol !== "blob:") {
      return undefined;
    }

    const normalizedValue = parsed.toString();
    return normalizedValue.length <= 4096 ? normalizedValue : undefined;
  } catch {
    return undefined;
  }
}

export function sanitizeTrackingUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  try {
    const parsed = new URL(trimmedValue);
    if (!SAFE_TRACKING_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }

    const normalizedValue = parsed.toString();
    return normalizedValue.length <= 2048 ? normalizedValue : null;
  } catch {
    return null;
  }
}
