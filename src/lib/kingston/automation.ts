import { timingSafeEqual } from "crypto";

import { workflowStates } from "@/lib/kingston/data";

export const automationStatusValues = Array.from(new Set(workflowStates.map((entry) => entry.status)));
export const automationZoneValues = Array.from(new Set(workflowStates.flatMap((entry) => entry.zones)));
export const automationDeliveryModeValues = ["Dispatch", "Pickup"] as const;
export const automationReimbursementValues = ["Pending", "Not applicable", "Requested", "In process", "Completed"] as const;
export const automationAvailabilityValues = ["Available", "Unavailable", "Pending"] as const;
export const automationQueueValues = [
  "open",
  "closed",
  "archived",
  "reimbursements",
  "pending-purchases",
  "pending-service"
] as const;

function extractAutomationApiKey(request: Request) {
  const bearerToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const headerToken = request.headers.get("x-kingestion-api-key");
  const urlToken =
    process.env.KINGESTION_ALLOW_API_KEY_QUERY_PARAM === "true"
      ? new URL(request.url).searchParams.get("apiKey")
      : null;

  return bearerToken?.trim() || headerToken?.trim() || urlToken?.trim() || null;
}

function keysMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function getAllowedAutomationKeys() {
  const primaryKey = process.env.KINGESTION_AUTOMATION_API_KEY?.trim();
  const extraKeys = (process.env.KINGESTION_AUTOMATION_EXTRA_KEYS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set([primaryKey, ...extraKeys].filter(Boolean))) as string[];
}

export function assertAutomationRequest(request: Request) {
  const allowedKeys = getAllowedAutomationKeys();

  if (allowedKeys.length === 0) {
    throw new Error("Falta configurar KINGESTION_AUTOMATION_API_KEY o KINGESTION_AUTOMATION_EXTRA_KEYS.");
  }

  const providedKey = extractAutomationApiKey(request);
  if (!providedKey || !allowedKeys.some((allowedKey) => keysMatch(allowedKey, providedKey))) {
    throw new Error("No autorizado para operar automatizaciones de Kingestion.");
  }
}

export function parseBooleanParam(value: string | null) {
  if (value === null) {
    return undefined;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (["1", "true", "si", "sí", "yes"].includes(normalizedValue)) {
    return true;
  }

  if (["0", "false", "no"].includes(normalizedValue)) {
    return false;
  }

  return undefined;
}
