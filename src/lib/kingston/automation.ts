import { workflowStates } from "@/lib/kingston/data";

export const automationStatusValues = Array.from(new Set(workflowStates.map((entry) => entry.status)));
export const automationZoneValues = Array.from(new Set(workflowStates.flatMap((entry) => entry.zones)));
export const automationDeliveryModeValues = ["Dispatch", "Pickup"] as const;
export const automationReimbursementValues = ["Pending", "Not applicable", "Requested", "Completed"] as const;
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
  const urlToken = new URL(request.url).searchParams.get("apiKey");

  return bearerToken?.trim() || headerToken?.trim() || urlToken?.trim() || null;
}

export function assertAutomationRequest(request: Request) {
  const expectedKey = process.env.KINGESTION_AUTOMATION_API_KEY?.trim();

  if (!expectedKey) {
    throw new Error("Falta configurar KINGESTION_AUTOMATION_API_KEY.");
  }

  const providedKey = extractAutomationApiKey(request);
  if (!providedKey || providedKey !== expectedKey) {
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
