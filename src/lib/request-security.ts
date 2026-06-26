export function getRequestClientKey(request: Request, discriminator?: string) {
  const forwardedFor = request.headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((value) => value.trim())
    .find(Boolean);
  const realIp = request.headers.get("x-real-ip")?.trim();
  const userAgent = request.headers.get("user-agent")?.trim() || "unknown";
  const baseKey = `${forwardedFor || realIp || "unknown"}|${userAgent.slice(0, 160)}`;

  return discriminator ? `${baseKey}|${discriminator}` : baseKey;
}

export function assertSameOriginRequest(request: Request) {
  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");
  const requestOrigin = new URL(request.url).origin;

  if (originHeader) {
    if (originHeader !== requestOrigin) {
      throw new Error("Origen no permitido.");
    }
    return;
  }

  if (refererHeader) {
    try {
      if (new URL(refererHeader).origin !== requestOrigin) {
        throw new Error("Origen no permitido.");
      }
      return;
    } catch {
      throw new Error("Origen no permitido.");
    }
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Origen no permitido.");
  }
}
