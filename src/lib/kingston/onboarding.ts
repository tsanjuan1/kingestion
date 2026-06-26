import type { ModulePermissionKey } from "@/lib/kingston/types";

export const moduleOnboardingIds = [
  "summary",
  "mail",
  "open-cases",
  "reimbursements",
  "pending-purchases",
  "pending-service",
  "closed-cases",
  "audit",
  "reports",
  "settings",
  "new-case",
  "case-detail",
  "profile",
  "search",
  "tasks",
  "workflow"
] as const;

export type ModuleOnboardingId = ModulePermissionKey | (typeof moduleOnboardingIds)[number];

export function isModuleOnboardingId(value: unknown): value is ModuleOnboardingId {
  return typeof value === "string" && (moduleOnboardingIds as readonly string[]).includes(value);
}
