import "server-only";

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Pool, PoolClient, QueryResultRow } from "pg";

import {
  archivedCasesSeed,
  getDefaultPermissionsForRole,
  kingstonCases,
  modulePermissionKeys
} from "@/lib/kingston/data";
import type {
  AutomationCloudStatus,
  AutomationControlState,
  AutomationTriggerResult,
  CaseAttachmentInput,
  CreateCaseInput,
  OwnerInput,
  RemoteControlAction,
  RemoteControlResult,
  RemoteControlSource,
  WorkspaceSnapshot
} from "@/lib/kingston/contracts";
import {
  buildCaseAddress,
  canAccessModule,
  canManageModule,
  getArchivedCases,
  getClosedCases,
  getQueueCompletionOptions,
  getInitialSubstatus,
  getNextActionCopy,
  getOpenCases,
  hasReachedReimbursementTrigger,
  isReimbursementZone,
  isClosedCaseStatus,
  normalizeStatus,
  shouldTrackReimbursement
} from "@/lib/kingston/helpers";
import { sanitizePreviewUrl, sanitizeTrackingUrl } from "@/lib/kingston/url-safety";
import type {
  CaseAttachment,
  CaseEvent,
  ClientBankingDetails,
  InteractionEntityType,
  KingstonCase,
  ModulePermissionKey,
  ModulePermissions,
  OwnerDirectoryEntry,
  UserRole,
  UserInteractionLog,
  WorkspaceDataState
} from "@/lib/kingston/types";

const WORKSPACE_ROW_KEY = "default";
const SESSION_COOKIE_NAME = "kingestion_session";
const SESSION_DURATION_DAYS = 14;
const AUTOMATION_CONTROL_NAMESPACE = "AUTOMATION";
const AUTOMATION_CONTROL_KEY = "KINGSTON_RMA_CONTROL";
const AUTOMATION_NATIVE_STATE_KEY = "KINGSTON_RMA_NATIVE_AUTOMATION";

function getPositiveIntegerEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: getPositiveIntegerEnv("KINGESTION_DB_POOL_MAX", 2),
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
  allowExitOnIdle: true
});

function quotePostgresIdentifier(identifier: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Identificador de rol invalido para Kingestion: ${identifier}`);
  }

  return `"${identifier.replace(/"/g, '""')}"`;
}

const runtimeDatabaseRole = process.env.KINGESTION_DB_RUNTIME_ROLE?.trim();
const quotedRuntimeDatabaseRole = runtimeDatabaseRole ? quotePostgresIdentifier(runtimeDatabaseRole) : null;
const rawPoolConnect = pool.connect.bind(pool);

async function applyRuntimeDatabaseRole(client: PoolClient) {
  if (quotedRuntimeDatabaseRole) {
    await client.query(`set role ${quotedRuntimeDatabaseRole}`);
  }
}

async function connectDatabaseClient() {
  const client = await rawPoolConnect();

  try {
    await applyRuntimeDatabaseRole(client);
    return client;
  } catch (error) {
    client.release();
    throw error;
  }
}

async function queryDatabase<T extends QueryResultRow = QueryResultRow>(statement: string, values?: unknown[]) {
  const client = await connectDatabaseClient();

  try {
    return await client.query<T>(statement, values);
  } finally {
    client.release();
  }
}

let schemaReadyPromise: Promise<void> | null = null;

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  role: OwnerDirectoryEntry["team"];
  initials: string;
  is_active: boolean;
  permissions_json: ModulePermissions | null;
  password_hash: string;
};

type SystemSettingRow = {
  namespace: string;
  key: string;
  value_json: unknown;
  description: string | null;
  updated_at: string;
};

type AttachmentBlobRow = {
  id: string;
  case_id: string | null;
  uploaded_by_user_id?: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  content_base64: string;
  created_at: string;
};

type CaseRow = {
  id: string;
  data_json: KingstonCase | string;
};

type KingestionRlsContext =
  | {
      system: true;
      user?: never;
    }
  | {
      system?: false;
      user: OwnerDirectoryEntry;
    };

export type KingestionQueuedEmail = {
  id: string;
  dedupeKey: string;
  to: string[];
  cc: string[];
  subject: string;
  text: string;
  html: string | null;
  inReplyTo: string | null;
  references: string[];
  messageId: string;
  metadata: Record<string, unknown>;
  status: "pending" | "sending" | "sent" | "error" | "failed";
  attempts: number;
  lastError: string | null;
  providerMessageId: string | null;
  sentAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type EmailOutboxRow = {
  id: string;
  dedupe_key: string;
  to_json: string[] | string;
  cc_json: string[] | string | null;
  subject: string;
  text_body: string;
  html_body: string | null;
  in_reply_to: string | null;
  references_json: string[] | string | null;
  message_id: string;
  metadata_json: Record<string, unknown> | string | null;
  status: KingestionQueuedEmail["status"];
  attempts: number;
  last_error?: string | null;
  provider_message_id?: string | null;
  sent_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type KingestionEmailHistoryItem = {
  id: string;
  to: string[];
  cc: string[];
  subject: string;
  textPreview: string;
  status: KingestionQueuedEmail["status"];
  attempts: number;
  lastError: string | null;
  providerMessageId: string | null;
  source: string;
  caseId: string | null;
  mailboxUid: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  sentAt: string | null;
};

export type KingestionEmailHistoryFilters = {
  caseId?: string | null;
};

export type AutomationCaseFilters = {
  q?: string;
  internalNumber?: string;
  kingstonNumber?: string;
  clientName?: string;
  status?: KingstonCase["externalStatus"];
  zone?: KingstonCase["zone"];
  includeArchived?: boolean;
  reimbursementState?: KingstonCase["logistics"]["reimbursementState"];
  queue?: "open" | "closed" | "archived" | "reimbursements" | "pending-purchases" | "pending-service";
  updatedSince?: string;
};

export type AutomationCasePatch = {
  owner?: string;
  status?: KingstonCase["externalStatus"];
  replacementSku?: string | null;
  comment?: {
    body: string;
    internal?: boolean;
  };
  attachment?: CaseAttachmentInput;
  logistics?: Partial<
    Pick<
      KingstonCase["logistics"],
      | "mode"
      | "address"
      | "transporter"
      | "guideNumber"
      | "trackingUrl"
      | "dispatchDate"
      | "deliveredDate"
      | "shippingCost"
      | "reimbursementState"
    >
  >;
  procurement?: Partial<
    Pick<
      KingstonCase["procurement"],
      | "localStock"
      | "wholesalerStock"
      | "wholesalerName"
      | "requiresKingstonOrder"
      | "kingstonRequestedAt"
      | "receivedFromUsaAt"
      | "releasedByPurchasing"
      | "releasedAt"
      | "movedToRmaWarehouse"
      | "movedToRmaWarehouseAt"
    >
  >;
  completeReimbursement?: boolean;
  completeQueueStep?: boolean;
  archive?: boolean;
  restore?: boolean;
};

export type AutomationActivityFilters = {
  since?: string;
  action?: string;
  entityType?: InteractionEntityType;
  limit?: number;
};

class WorkspaceHttpError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const clientDirectory: Record<
  string,
  {
    fullAddress: string;
    banking: ClientBankingDetails;
  }
> = {
  "Micro Delta SA": {
    fullAddress: "Av. Colon 4132, Piso 3, Cordoba Capital, Cordoba, Argentina",
    banking: {
      bankName: "Banco Galicia",
      accountHolder: "Micro Delta SA",
      cuit: "30-70881122-4",
      cbu: "0070341820000001265789",
      alias: "MICRODELTA.RMA",
      accountNumber: "3421/8"
    }
  },
  "Compu Norte SRL": {
    fullAddress: "Parana 758, Oficina 4B, CABA, Buenos Aires, Argentina",
    banking: {
      bankName: "Santander",
      accountHolder: "Compu Norte SRL",
      cuit: "30-71124567-2",
      cbu: "0720019820000004523187",
      alias: "COMPUNORTE.RETIRO",
      accountNumber: "198245/2"
    }
  },
  "Nexo Digital": {
    fullAddress: "Ruta 197 Km 2.8, Parque Industrial, San Miguel, Buenos Aires, Argentina",
    banking: {
      bankName: "BBVA",
      accountHolder: "Nexo Digital SA",
      cuit: "30-70991238-8",
      cbu: "0170183720000003348921",
      alias: "NEXODIGITAL.SSD",
      accountNumber: "1837/5"
    }
  },
  "Grupo Atlas IT": {
    fullAddress: "San Martin 1462, Godoy Cruz, Mendoza, Argentina",
    banking: {
      bankName: "Banco Macro",
      accountHolder: "Grupo Atlas IT",
      cuit: "30-71200977-5",
      cbu: "2850597820099001234567",
      alias: "ATLASIT.KINGSTON",
      accountNumber: "5978/2"
    }
  },
  "Hyperlink SA": {
    fullAddress: "Sarmiento 920, Piso 7, CABA, Buenos Aires, Argentina",
    banking: {
      bankName: "ICBC",
      accountHolder: "Hyperlink SA",
      cuit: "30-71441209-1",
      cbu: "0150459820000008823145",
      alias: "HYPERLINK.RMA",
      accountNumber: "4598/0"
    }
  },
  "Orbit Solutions": {
    fullAddress: "Vuelta de Obligado 1823, CABA, Buenos Aires, Argentina",
    banking: {
      bankName: "Banco Provincia",
      accountHolder: "Orbit Solutions SRL",
      cuit: "30-71601854-6",
      cbu: "0140999820000005501234",
      alias: "ORBIT.REEMPLAZOS",
      accountNumber: "99982/4"
    }
  },
  "Data Vision Patagonia": {
    fullAddress: "Belgrano 455, Neuquen Capital, Neuquen, Argentina",
    banking: {
      bankName: "Banco Patagonia",
      accountHolder: "Data Vision Patagonia SA",
      cuit: "30-71733122-7",
      cbu: "0340145820000001189201",
      alias: "DATAVISION.PAT",
      accountNumber: "145/9"
    }
  },
  "Zeta Servicios Informaticos": {
    fullAddress: "Av. Santa Fe 3250, Piso 8, CABA, Buenos Aires, Argentina",
    banking: {
      bankName: "HSBC",
      accountHolder: "Zeta Servicios Informaticos SRL",
      cuit: "30-71844011-3",
      cbu: "1500045820000007745120",
      alias: "ZETA.SERVICIOS.RMA",
      accountNumber: "45820/1"
    }
  }
};

function createId(prefix: string) {
  return `${prefix}-${randomBytes(8).toString("hex")}`;
}

function createDeterministicMessageId(dedupeKey: string) {
  const digest = createHash("sha256").update(dedupeKey).digest("hex").slice(0, 32);
  return `<kingestion-${digest}@kingestion.local>`;
}

function normalizeJsonStringArray(value: unknown): string[] {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function normalizeJsonObject(value: unknown): Record<string, unknown> {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function normalizeOutboxStatus(value: string): KingestionQueuedEmail["status"] {
  return value === "pending" || value === "sending" || value === "sent" || value === "error" || value === "failed"
    ? value
    : "error";
}

function normalizeEmailOutboxRow(row: EmailOutboxRow): KingestionQueuedEmail {
  return {
    id: row.id,
    dedupeKey: row.dedupe_key,
    to: normalizeJsonStringArray(row.to_json),
    cc: normalizeJsonStringArray(row.cc_json),
    subject: row.subject,
    text: row.text_body,
    html: row.html_body,
    inReplyTo: row.in_reply_to,
    references: normalizeJsonStringArray(row.references_json),
    messageId: row.message_id,
    metadata: normalizeJsonObject(row.metadata_json),
    status: normalizeOutboxStatus(row.status),
    attempts: row.attempts,
    lastError: row.last_error ?? null,
    providerMessageId: row.provider_message_id ?? null,
    sentAt: row.sent_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null
  };
}

function normalizeEmailHistoryRow(row: EmailOutboxRow): KingestionEmailHistoryItem {
  const metadata = normalizeJsonObject(row.metadata_json);

  return {
    id: row.id,
    to: normalizeJsonStringArray(row.to_json),
    cc: normalizeJsonStringArray(row.cc_json),
    subject: row.subject,
    textPreview: row.text_body.replace(/\s+/g, " ").trim().slice(0, 280),
    status: normalizeOutboxStatus(row.status),
    attempts: row.attempts,
    lastError: row.last_error ?? null,
    providerMessageId: row.provider_message_id ?? null,
    source: typeof metadata.source === "string" ? metadata.source : "automation",
    caseId: typeof metadata.caseId === "string" ? metadata.caseId : null,
    mailboxUid:
      typeof metadata.mailboxUid === "string" || typeof metadata.mailboxUid === "number"
        ? String(metadata.mailboxUid)
        : null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    sentAt: row.sent_at ?? null
  };
}

function createEmptyPermissions(): ModulePermissions {
  return modulePermissionKeys.reduce<ModulePermissions>((accumulator, moduleKey) => {
    accumulator[moduleKey] = { view: false, manage: false };
    return accumulator;
  }, {} as ModulePermissions);
}

function buildInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "NA";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

function addDays(baseDate: Date, days: number) {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString();
}

function getSlaDays(priority: KingstonCase["priority"]) {
  switch (priority) {
    case "Critical":
      return 2;
    case "High":
      return 3;
    case "Low":
      return 7;
    default:
      return 5;
  }
}

function getInitialTaskDueDays(priority: KingstonCase["priority"]) {
  switch (priority) {
    case "Critical":
      return 1;
    case "Low":
      return 3;
    default:
      return 2;
  }
}

function getAttachmentMaxBytes() {
  const parsed = Number(process.env.KINGESTION_ATTACHMENT_MAX_BYTES ?? 15 * 1024 * 1024);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15 * 1024 * 1024;
}

function inferAttachmentKind(name: string): KingstonCase["attachments"][number]["kind"] {
  const normalizedName = name.toLowerCase();

  if (normalizedName.endsWith(".eml") || normalizedName.endsWith(".msg")) {
    return "mail";
  }

  if (/\.(png|jpe?g|webp|heic|gif)$/i.test(normalizedName)) {
    return "photo";
  }

  if (normalizedName.includes("guia") || normalizedName.includes("tracking")) {
    return "guide";
  }

  if (normalizedName.includes("form") || normalizedName.includes("formulario")) {
    return "form";
  }

  return "proof";
}

function canManageReimbursementForUser(user: OwnerDirectoryEntry | null) {
  return Boolean(
    user &&
      (user.team === "ADMIN" ||
        user.team === "PURCHASING" ||
        user.team === "PAYMENTS" ||
        canManageModule(user.permissions, "reimbursements"))
  );
}

function normalizePermissions(role: OwnerDirectoryEntry["team"], permissions?: ModulePermissions | null): ModulePermissions {
  const defaults = getDefaultPermissionsForRole(role);

  return modulePermissionKeys.reduce<ModulePermissions>((accumulator, moduleKey) => {
    accumulator[moduleKey] = {
      view: permissions?.[moduleKey]?.view ?? defaults[moduleKey].view,
      manage: permissions?.[moduleKey]?.manage ?? defaults[moduleKey].manage
    };
    return accumulator;
  }, {} as ModulePermissions);
}

function normalizeOwner(row: UserRow): OwnerDirectoryEntry {
  return {
    id: row.id,
    name: row.full_name,
    email: row.email,
    team: row.role,
    active: row.is_active,
    initials: row.initials || buildInitials(row.full_name),
    permissions: normalizePermissions(row.role, row.permissions_json)
  };
}

function normalizeCase(entry: KingstonCase): KingstonCase {
  const normalizedStatus = normalizeStatus(entry.externalStatus);
  const clientDetails = clientDirectory[entry.clientName];
  const baseAddress = clientDetails?.fullAddress ?? buildCaseAddress(entry);
  const logisticsAddress =
    entry.deliveryMode === "Pickup" ? entry.logistics.address : clientDetails?.fullAddress ?? entry.logistics.address;
  const hasProofAttachment = entry.attachments.some(
    (attachment) => attachment.kind === "proof" || attachment.kind === "photo"
  );
  const isEligibleForReimbursementFlow =
    isReimbursementZone(entry.zone) &&
    (hasReachedReimbursementTrigger(normalizedStatus, entry.zone) ||
      entry.logistics.reimbursementState === "Pending" ||
      entry.logistics.reimbursementState === "Requested" ||
      entry.logistics.reimbursementState === "In process" ||
      entry.logistics.reimbursementState === "Completed");
  const normalizedReimbursementState =
    entry.logistics.reimbursementState === "Completed"
      ? "Completed"
      : entry.logistics.reimbursementState === "In process"
        ? "In process"
      : isEligibleForReimbursementFlow
        ? hasProofAttachment
          ? "Requested"
          : "Pending"
        : "Not applicable";

  return {
    ...entry,
    externalStatus: normalizedStatus,
    address: baseAddress,
    replacementSku: entry.replacementSku ?? null,
    archivedAt: entry.archivedAt ?? null,
    archivedBy: entry.archivedBy ?? null,
    banking: entry.banking ?? clientDetails?.banking,
    nextAction: entry.nextAction || getNextActionCopy(normalizedStatus),
    internalSubstatus: entry.internalSubstatus || getInitialSubstatus(normalizedStatus, entry.zone),
    logistics: {
      ...entry.logistics,
      address: logisticsAddress,
      reimbursementState: normalizedReimbursementState
    }
  };
}

function getDefaultWorkspaceData(): WorkspaceDataState {
  return {
    cases: [...kingstonCases, ...archivedCasesSeed].map(normalizeCase),
    auditLog: []
  };
}

function normalizeWorkspaceData(
  rawState: WorkspaceDataState | null | undefined,
  options?: {
    cases?: KingstonCase[];
    useFallbackCases?: boolean;
  }
): WorkspaceDataState {
  const fallback = getDefaultWorkspaceData();
  const sourceCases = options?.cases ?? (Array.isArray(rawState?.cases) ? rawState.cases : undefined);
  const shouldUseFallbackCases = options?.useFallbackCases ?? true;

  return {
    cases:
      sourceCases && sourceCases.length > 0
        ? sourceCases.map(normalizeCase)
        : shouldUseFallbackCases
          ? fallback.cases
          : [],
    auditLog: Array.isArray(rawState?.auditLog) ? rawState.auditLog : fallback.auditLog
  };
}

function buildDefaultAutomationControlState(): AutomationControlState {
  return {
    paused: false,
    pausedAt: null,
    pausedByUserId: null,
    pausedByUserName: null
  };
}

function normalizeAutomationControlState(rawValue: unknown): AutomationControlState {
  if (!rawValue || typeof rawValue !== "object") {
    return buildDefaultAutomationControlState();
  }

  const value = rawValue as Partial<AutomationControlState>;

  return {
    paused: value.paused === true,
    pausedAt: typeof value.pausedAt === "string" ? value.pausedAt : null,
    pausedByUserId: typeof value.pausedByUserId === "string" ? value.pausedByUserId : null,
    pausedByUserName: typeof value.pausedByUserName === "string" ? value.pausedByUserName : null
  };
}

function createAutomationActor(): OwnerDirectoryEntry {
  return {
    id: "automation-kingestion",
    name: "Automatizacion Kingestion",
    email: process.env.KINGESTION_AUTOMATION_ACTOR_EMAIL?.trim().toLowerCase() || "automation@kingestion.local",
    team: "ADMIN",
    active: true,
    initials: "KG",
    permissions: normalizePermissions("ADMIN")
  };
}

export function createRemoteControlActor(): OwnerDirectoryEntry {
  return {
    id: "remote-control-api",
    name: "Control remoto",
    email: process.env.KINGESTION_AUTOMATION_ACTOR_EMAIL?.trim().toLowerCase() || "controlremoto@kingestion.local",
    team: "ADMIN",
    active: true,
    initials: "RC",
    permissions: normalizePermissions("ADMIN")
  };
}

function canInspectDirectory(currentUser: OwnerDirectoryEntry) {
  return currentUser.team === "ADMIN" || canAccessModule(currentUser.permissions, "settings");
}

function canInspectAuditLog(currentUser: OwnerDirectoryEntry) {
  return currentUser.team === "ADMIN" || canAccessModule(currentUser.permissions, "audit");
}

function canSeeAuditFromReports(currentUser: OwnerDirectoryEntry) {
  return currentUser.team === "ADMIN" || canAccessModule(currentUser.permissions, "audit");
}

function canSeeBankingDetails(currentUser: OwnerDirectoryEntry) {
  return (
    currentUser.team === "ADMIN" ||
    currentUser.team === "PURCHASING" ||
    currentUser.team === "PAYMENTS" ||
    canAccessModule(currentUser.permissions, "reimbursements")
  );
}

function canSeeArchivedCases(currentUser: OwnerDirectoryEntry) {
  return currentUser.team === "ADMIN";
}

function canSeeCaseInSnapshot(entry: KingstonCase, currentUser: OwnerDirectoryEntry) {
  if (entry.archivedAt) {
    return canSeeArchivedCases(currentUser);
  }

  if (currentUser.team === "ADMIN" || canInspectDirectory(currentUser)) {
    return true;
  }

  if (canAccessModule(currentUser.permissions, "reports")) {
    return true;
  }

  if (!isClosedCaseStatus(entry.externalStatus) && canAccessModule(currentUser.permissions, "open-cases")) {
    return true;
  }

  if (isClosedCaseStatus(entry.externalStatus) && canAccessModule(currentUser.permissions, "closed-cases")) {
    return true;
  }

  if (
    canAccessModule(currentUser.permissions, "pending-purchases") &&
    (entry.externalStatus === "Liberar mercaderia" ||
      entry.externalStatus === "OV creada" ||
      entry.externalStatus === "Pedido Kingston")
  ) {
    return true;
  }

  if (
    canAccessModule(currentUser.permissions, "pending-service") &&
    (entry.externalStatus === "Informado" || entry.externalStatus === "Pedido deposito y etiquetado")
  ) {
    return true;
  }

  if (canAccessModule(currentUser.permissions, "reimbursements") && shouldTrackReimbursement(entry)) {
    return true;
  }

  return false;
}

function sanitizeOwnerForUser(owner: OwnerDirectoryEntry, currentUser: OwnerDirectoryEntry): OwnerDirectoryEntry {
  if (owner.id === currentUser.id || canInspectDirectory(currentUser)) {
    return owner;
  }

  return {
    ...owner,
    email: "",
    permissions: createEmptyPermissions()
  };
}

function sanitizeCaseForUser(entry: KingstonCase, currentUser: OwnerDirectoryEntry): KingstonCase {
  return {
    ...entry,
    banking: canSeeBankingDetails(currentUser) ? entry.banking : undefined,
    attachments: entry.attachments.map((attachment) => ({
      ...attachment,
      previewUrl: sanitizePreviewUrl(attachment.previewUrl)
    })),
    logistics: {
      ...entry.logistics,
      trackingUrl: sanitizeTrackingUrl(entry.logistics.trackingUrl)
    }
  };
}

function sanitizeAuditLogForUser(
  auditLog: UserInteractionLog[],
  currentUser: OwnerDirectoryEntry,
  visibleCaseIds: Set<string>
) {
  if (canInspectAuditLog(currentUser)) {
    return auditLog;
  }

  if (canSeeAuditFromReports(currentUser)) {
    return auditLog
      .filter((entry) => entry.entityType === "case" || entry.entityType === "report")
      .slice(0, 200);
  }

  return auditLog
    .filter(
      (entry) =>
        (entry.entityType === "case" && visibleCaseIds.has(entry.entityId)) ||
        (entry.actorId !== null && entry.actorId === currentUser.id)
    )
    .slice(0, 100);
}

function buildWorkspaceSnapshotForUser(
  workspaceData: WorkspaceDataState,
  owners: OwnerDirectoryEntry[],
  currentUser: OwnerDirectoryEntry
): WorkspaceSnapshot {
  const visibleCases = workspaceData.cases
    .filter((entry) => canSeeCaseInSnapshot(entry, currentUser))
    .map((entry) => sanitizeCaseForUser(entry, currentUser));
  const visibleCaseIds = new Set(visibleCases.map((entry) => entry.id));
  const visibleOwners = canInspectDirectory(currentUser)
    ? owners
    : owners
        .filter((owner) => owner.active || owner.id === currentUser.id)
        .map((owner) => sanitizeOwnerForUser(owner, currentUser));

  return {
    cases: visibleCases,
    auditLog: sanitizeAuditLogForUser(workspaceData.auditLog, currentUser, visibleCaseIds),
    owners: visibleOwners,
    currentUser
  };
}

function matchesAutomationCaseFilters(entry: KingstonCase, filters: AutomationCaseFilters) {
  const normalizedSearch = filters.q?.trim().toLowerCase();
  const normalizedInternal = filters.internalNumber?.trim().toLowerCase();
  const normalizedKingston = filters.kingstonNumber?.trim().toLowerCase();
  const normalizedClient = filters.clientName?.trim().toLowerCase();
  const updatedSinceTimestamp = filters.updatedSince ? new Date(filters.updatedSince).getTime() : null;
  const isArchived = Boolean(entry.archivedAt);
  const isClosed =
    entry.externalStatus === "Realizado" || entry.externalStatus === "Vencido" || entry.externalStatus === "Cerrado";
  const isPendingReimbursement =
    shouldTrackReimbursement(entry) && entry.logistics.reimbursementState !== "Completed" && !isArchived;
  const isPendingPurchase =
    !isArchived &&
    (entry.externalStatus === "Liberar mercaderia" ||
      entry.externalStatus === "OV creada" ||
      entry.externalStatus === "Pedido Kingston");
  const isPendingService =
    !isArchived && (entry.externalStatus === "Informado" || entry.externalStatus === "Pedido deposito y etiquetado");

  if (normalizedSearch) {
    const searchableContent = [
      entry.internalNumber,
      entry.kingstonNumber,
      entry.clientName,
      entry.contactName,
      entry.contactEmail,
      entry.sku,
      entry.replacementSku ?? "",
      entry.owner,
      entry.address,
      entry.city,
      entry.province
    ]
      .join(" ")
      .toLowerCase();

    if (!searchableContent.includes(normalizedSearch)) {
      return false;
    }
  }

  if (normalizedInternal && !entry.internalNumber.toLowerCase().includes(normalizedInternal)) {
    return false;
  }

  if (normalizedKingston && !entry.kingstonNumber.toLowerCase().includes(normalizedKingston)) {
    return false;
  }

  if (normalizedClient && !entry.clientName.toLowerCase().includes(normalizedClient)) {
    return false;
  }

  if (filters.status && entry.externalStatus !== filters.status) {
    return false;
  }

  if (filters.zone && entry.zone !== filters.zone) {
    return false;
  }

  if (filters.reimbursementState && entry.logistics.reimbursementState !== filters.reimbursementState) {
    return false;
  }

  if (updatedSinceTimestamp && new Date(entry.updatedAt).getTime() < updatedSinceTimestamp) {
    return false;
  }

  if (!filters.includeArchived && isArchived) {
    return false;
  }

  switch (filters.queue) {
    case "open":
      return !isArchived && !isClosed;
    case "closed":
      return !isArchived && isClosed;
    case "archived":
      return isArchived;
    case "reimbursements":
      return isPendingReimbursement;
    case "pending-purchases":
      return isPendingPurchase;
    case "pending-service":
      return isPendingService;
    default:
      return true;
  }
}

function createAuditEntry(
  actor: OwnerDirectoryEntry | null,
  payload: Omit<UserInteractionLog, "id" | "actorId" | "actorName" | "createdAt">
): UserInteractionLog {
  return {
    id: createId("audit"),
    actorId: actor?.id ?? null,
    actorName: actor?.name ?? "Sesion sin responsable activo",
    createdAt: new Date().toISOString(),
    ...payload
  };
}

function appendAuditLog(
  state: WorkspaceDataState,
  actor: OwnerDirectoryEntry | null,
  payload: Omit<UserInteractionLog, "id" | "actorId" | "actorName" | "createdAt">
): WorkspaceDataState {
  return {
    ...state,
    auditLog: [createAuditEntry(actor, payload), ...state.auditLog].slice(0, 500)
  };
}

function isAutomaticAssignmentEligible(entry: KingstonCase) {
  return !entry.archivedAt && !isClosedCaseStatus(entry.externalStatus);
}

function getAutomaticOwnerRole(entry: KingstonCase): UserRole | null {
  if (!isAutomaticAssignmentEligible(entry)) {
    return null;
  }

  // Reintegros es una bandeja paralela: no debe pisar el responsable operativo del estado actual.
  switch (entry.externalStatus) {
    case "Liberar mercaderia":
    case "OV creada":
    case "Pedido Kingston":
      return "PURCHASING";
    case "Informado":
    case "Caso recibido":
    case "Producto recepcionado y en preparacion":
    case "En stock":
    case "Pendiente de recibirlo":
    case "Producto enviado":
    case "Producto listo para retiro":
      return "SALES";
    case "Aviso de envio":
    case "Pedido deposito y etiquetado":
    case "Pedido guia":
      return "TECHNICAL_SERVICE";
    default:
      return "SALES";
  }
}

function selectAutomaticOwnerName(
  targetCase: KingstonCase,
  workspaceData: WorkspaceDataState,
  owners: OwnerDirectoryEntry[]
) {
  const targetRole = getAutomaticOwnerRole(targetCase);

  if (!targetRole) {
    return targetCase.owner;
  }

  const candidates = owners.filter((owner) => owner.active && owner.team === targetRole);
  const currentOwnerIsValid = candidates.some((owner) => owner.name === targetCase.owner);

  if (currentOwnerIsValid) {
    return targetCase.owner;
  }

  if (candidates.length === 0) {
    return "Sin asignar";
  }

  const loads = new Map(candidates.map((owner) => [owner.name, 0]));

  for (const entry of workspaceData.cases) {
    if (entry.id === targetCase.id || !isAutomaticAssignmentEligible(entry)) {
      continue;
    }

    if (loads.has(entry.owner)) {
      loads.set(entry.owner, (loads.get(entry.owner) ?? 0) + 1);
    }
  }

  return [...candidates].sort((left, right) => {
    const loadDiff = (loads.get(left.name) ?? 0) - (loads.get(right.name) ?? 0);
    return loadDiff || left.name.localeCompare(right.name, "es");
  })[0]?.name ?? "Sin asignar";
}

function applyAutomaticCaseOwner(
  workspaceData: WorkspaceDataState,
  currentUser: OwnerDirectoryEntry,
  caseId: string,
  owners: OwnerDirectoryEntry[],
  reason: string
) {
  const targetCase = workspaceData.cases.find((entry) => entry.id === caseId);

  if (!targetCase) {
    return workspaceData;
  }

  const nextOwner = selectAutomaticOwnerName(targetCase, workspaceData, owners);

  if (targetCase.owner === nextOwner) {
    return workspaceData;
  }

  const now = new Date().toISOString();
  const nextCases = workspaceData.cases.map((entry): KingstonCase => {
    if (entry.id !== caseId) {
      return entry;
    }

    return normalizeCase({
      ...entry,
      owner: nextOwner,
      updatedAt: now,
      tasks: entry.tasks.map((task) =>
        task.state === "Completed"
          ? task
          : {
              ...task,
              assignee: nextOwner
            }
      ),
      events: [
        {
          id: createId("event"),
          kind: "task",
          title: "Responsable asignado automaticamente",
          detail: `El caso quedo asignado a ${nextOwner} por regla de estado y sector.`,
          actor: currentUser.name,
          createdAt: now
        },
        ...entry.events
      ]
    });
  });

  return appendAuditLog(
    {
      ...workspaceData,
      cases: nextCases
    },
    currentUser,
    {
      entityType: "case",
      entityId: caseId,
      action: "case-owner-updated",
      detail: `Asignacion automatica de ${targetCase.internalNumber}: ${nextOwner}. ${reason}`
    }
  );
}

function applyAutomaticCaseOwners(
  workspaceData: WorkspaceDataState,
  currentUser: OwnerDirectoryEntry,
  owners: OwnerDirectoryEntry[],
  reason: string
) {
  let nextWorkspaceData = workspaceData;

  for (const entry of workspaceData.cases) {
    nextWorkspaceData = applyAutomaticCaseOwner(nextWorkspaceData, currentUser, entry.id, owners, reason);
  }

  return nextWorkspaceData;
}

function assertCaseIsMutable(targetCase: KingstonCase) {
  if (targetCase.archivedAt) {
    throw new WorkspaceHttpError("El caso esta archivado. Restauralo antes de volver a modificarlo.", 409);
  }
}

function getNextInternalCaseNumber(cases: KingstonCase[]) {
  return (
    cases.reduce((maxValue, entry) => {
      const internalMatch = entry.internalNumber.match(/RMA-(\d+)/i);
      const idMatch = entry.id.match(/rma-(\d+)/i);
      const currentValue = Number(internalMatch?.[1] ?? idMatch?.[1] ?? 0);

      return currentValue > maxValue ? currentValue : maxValue;
    }, 24000) + 1
  );
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const derivedBuffer = scryptSync(password, salt, 64);
  const hashBuffer = Buffer.from(hash, "hex");
  if (derivedBuffer.length !== hashBuffer.length) return false;
  return timingSafeEqual(derivedBuffer, hashBuffer);
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isInsufficientDatabasePrivilegeError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "42501");
}

function toNullableTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function buildCaseRowValues(entry: KingstonCase) {
  const normalizedCase = normalizeCase(entry);

  return [
    normalizedCase.id,
    normalizedCase.internalNumber,
    normalizedCase.kingstonNumber,
    normalizedCase.clientName,
    normalizedCase.contactEmail,
    normalizedCase.owner,
    normalizedCase.externalStatus,
    normalizedCase.zone,
    normalizedCase.deliveryMode,
    normalizedCase.priority,
    toNullableTimestamp(normalizedCase.openedAt),
    toNullableTimestamp(normalizedCase.updatedAt),
    toNullableTimestamp(normalizedCase.archivedAt),
    normalizedCase.logistics.reimbursementState,
    JSON.stringify(normalizedCase)
  ];
}

function parseCaseRow(row: CaseRow): KingstonCase | null {
  try {
    const value = typeof row.data_json === "string" ? JSON.parse(row.data_json) : row.data_json;
    return value && typeof value === "object" ? normalizeCase(value as KingstonCase) : null;
  } catch {
    return null;
  }
}

function stripCasesFromWorkspaceState(state: WorkspaceDataState): WorkspaceDataState {
  return {
    ...state,
    cases: []
  };
}

async function setKingestionRlsContext(client: PoolClient, context: KingestionRlsContext) {
  const user = "user" in context ? context.user : null;

  await client.query(
    `
      select
        set_config('kingestion.system', $1, true),
        set_config('kingestion.user_id', $2, true),
        set_config('kingestion.user_role', $3, true),
        set_config('kingestion.permissions', $4, true)
    `,
    [
      context.system ? "true" : "false",
      user?.id ?? "",
      user?.team ?? "",
      JSON.stringify(user?.permissions ?? {})
    ]
  );
}

async function upsertCaseRows(cases: KingstonCase[], runner: Pool | PoolClient) {
  for (const entry of cases) {
    await runner.query(
      `
        insert into kingestion_cases (
          id,
          internal_number,
          kingston_number,
          client_name,
          contact_email,
          owner_name,
          external_status,
          zone,
          delivery_mode,
          priority,
          opened_at,
          updated_at,
          archived_at,
          reimbursement_state,
          data_json
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11::timestamptz,
          $12::timestamptz,
          $13::timestamptz,
          $14,
          $15::jsonb
        )
        on conflict (id) do update
          set internal_number = excluded.internal_number,
              kingston_number = excluded.kingston_number,
              client_name = excluded.client_name,
              contact_email = excluded.contact_email,
              owner_name = excluded.owner_name,
              external_status = excluded.external_status,
              zone = excluded.zone,
              delivery_mode = excluded.delivery_mode,
              priority = excluded.priority,
              opened_at = excluded.opened_at,
              updated_at = excluded.updated_at,
              archived_at = excluded.archived_at,
              reimbursement_state = excluded.reimbursement_state,
              data_json = excluded.data_json,
              persisted_at = now()
      `,
      buildCaseRowValues(entry)
    );
  }
}

async function replaceCaseRows(cases: KingstonCase[], runner: Pool | PoolClient) {
  await upsertCaseRows(cases, runner);

  if (cases.length === 0) {
    await runner.query(`delete from kingestion_cases`);
    return;
  }

  await runner.query(`delete from kingestion_cases where not (id = any($1::text[]))`, [
    cases.map((entry) => entry.id)
  ]);
}

async function migrateWorkspaceCasesToCaseRows() {
  const client = await connectDatabaseClient();

  try {
    await client.query("begin");
    await setKingestionRlsContext(client, { system: true });

    const result = await client.query<{ data_json: WorkspaceDataState }>(
      `
        select data_json
        from kingestion_workspace_state
        where key = $1
        for update
      `,
      [WORKSPACE_ROW_KEY]
    );
    const rawState = result.rows[0]?.data_json;
    const rawCases = Array.isArray(rawState?.cases) ? rawState.cases : [];

    if (rawCases.length > 0) {
      const normalizedState = normalizeWorkspaceData(rawState);
      await upsertCaseRows(normalizedState.cases, client);
      await client.query(
        `
          update kingestion_workspace_state
          set data_json = $2::jsonb,
              updated_at = now()
          where key = $1
        `,
        [WORKSPACE_ROW_KEY, JSON.stringify(stripCasesFromWorkspaceState(normalizedState))]
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function ensureKingestionRlsPolicies() {
  try {
    await queryDatabase(`
      create or replace function public.kingestion_has_module_permission(module_key text, permission_key text default 'view')
      returns boolean
      language sql
      stable
      as $kingestion_permission$
        select coalesce(
          (
            (
              coalesce(nullif(current_setting('kingestion.permissions', true), '')::jsonb, '{}'::jsonb)
              -> module_key
              ->> permission_key
            )::boolean
          ),
          false
        )
      $kingestion_permission$;
    `);

    await queryDatabase(`
      do $$
      declare
        target_table text;
        target_tables text[] := array[
          'kingestion_users',
          'kingestion_sessions',
          'kingestion_workspace_state',
          'kingestion_system_settings',
          'kingestion_runtime_locks',
          'kingestion_email_outbox',
          'kingestion_attachment_blobs',
          'kingestion_rate_limits'
        ];
      begin
        if not exists (select 1 from pg_roles where rolname = 'kingestion_app') then
          return;
        end if;

        foreach target_table in array target_tables loop
          if to_regclass(format('public.%I', target_table)) is not null then
            execute format('alter table public.%I enable row level security', target_table);
            execute format('alter table public.%I force row level security', target_table);
            execute format('drop policy if exists kingestion_app_all on public.%I', target_table);
            execute format(
              'create policy kingestion_app_all on public.%I for all to kingestion_app using (true) with check (true)',
              target_table
            );
          end if;
        end loop;

        if to_regclass('public.kingestion_cases') is not null then
          execute 'grant select, insert, update, delete on public.kingestion_cases to kingestion_app';
          execute 'alter table public.kingestion_cases enable row level security';
          execute 'alter table public.kingestion_cases force row level security';
          execute 'drop policy if exists kingestion_app_all on public.kingestion_cases';
          execute 'drop policy if exists kingestion_cases_system_all on public.kingestion_cases';
          execute 'drop policy if exists kingestion_cases_user_select on public.kingestion_cases';
          execute '
            create policy kingestion_cases_system_all
            on public.kingestion_cases
            for all
            to kingestion_app
            using ((select current_setting(''kingestion.system'', true)) = ''true'')
            with check ((select current_setting(''kingestion.system'', true)) = ''true'')
          ';
          execute '
            create policy kingestion_cases_user_select
            on public.kingestion_cases
            for select
            to kingestion_app
            using (
              (select current_setting(''kingestion.system'', true)) = ''true''
              or (select current_setting(''kingestion.user_role'', true)) = ''ADMIN''
              or (
                archived_at is null
                and (
                  (select public.kingestion_has_module_permission(''settings'', ''view''))
                  or (select public.kingestion_has_module_permission(''reports'', ''view''))
                  or (
                    external_status not in (''Realizado'', ''Vencido'', ''Cerrado'')
                    and (select public.kingestion_has_module_permission(''open-cases'', ''view''))
                  )
                  or (
                    external_status in (''Realizado'', ''Vencido'', ''Cerrado'')
                    and (select public.kingestion_has_module_permission(''closed-cases'', ''view''))
                  )
                  or (
                    external_status in (''Liberar mercaderia'', ''OV creada'', ''Pedido Kingston'')
                    and (select public.kingestion_has_module_permission(''pending-purchases'', ''view''))
                  )
                  or (
                    external_status in (''Informado'', ''Pedido deposito y etiquetado'')
                    and (select public.kingestion_has_module_permission(''pending-service'', ''view''))
                  )
                  or (
                    zone = ''Interior / Gran Buenos Aires''
                    and reimbursement_state in (''Pending'', ''Requested'', ''In process'')
                    and (select public.kingestion_has_module_permission(''reimbursements'', ''view''))
                  )
                )
              )
            )
          ';
          execute 'grant execute on function public.kingestion_has_module_permission(text, text) to kingestion_app';
        end if;
      end $$;
    `);
  } catch (error) {
    if (isInsufficientDatabasePrivilegeError(error)) {
      return;
    }

    throw error;
  }
}

async function runOptionalSchemaDdl(statement: string) {
  try {
    await queryDatabase(statement);
  } catch (error) {
    if (isInsufficientDatabasePrivilegeError(error)) {
      return;
    }

    throw error;
  }
}

async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt
  });
}

async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0)
  });
}

export async function ensureKingestionSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      if (!process.env.DATABASE_URL) {
        throw new Error("Falta DATABASE_URL para inicializar Kingestion.");
      }

      await queryDatabase(`
        create table if not exists kingestion_users (
          id text primary key,
          email text unique not null,
          full_name text not null,
          password_hash text not null,
          role text not null,
          initials text not null,
          is_active boolean not null default true,
          permissions_json jsonb not null default '{}'::jsonb,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );

        create table if not exists kingestion_sessions (
          id text primary key,
          user_id text not null references kingestion_users(id) on delete cascade,
          token_hash text unique not null,
          expires_at timestamptz not null,
          created_at timestamptz not null default now()
        );

        create table if not exists kingestion_workspace_state (
          key text primary key,
          data_json jsonb not null,
          updated_at timestamptz not null default now()
        );

        create table if not exists kingestion_cases (
          id text primary key,
          internal_number text not null,
          kingston_number text not null default '',
          client_name text not null default '',
          contact_email text not null default '',
          owner_name text not null default 'Sin asignar',
          external_status text not null,
          zone text not null,
          delivery_mode text not null,
          priority text not null,
          opened_at timestamptz,
          updated_at timestamptz,
          archived_at timestamptz,
          reimbursement_state text not null default 'Not applicable',
          data_json jsonb not null,
          persisted_at timestamptz not null default now()
        );

        create table if not exists kingestion_system_settings (
          namespace text not null,
          key text not null,
          value_json jsonb not null default '{}'::jsonb,
          description text,
          updated_at timestamptz not null default now(),
          primary key (namespace, key)
        );

        create table if not exists kingestion_runtime_locks (
          lock_name text primary key,
          lock_owner text not null,
          expires_at timestamptz not null,
          updated_at timestamptz not null default now()
        );

        create table if not exists kingestion_email_outbox (
          id text primary key,
          dedupe_key text unique not null,
          to_json jsonb not null,
          cc_json jsonb not null default '[]'::jsonb,
          subject text not null,
          text_body text not null,
          html_body text,
          in_reply_to text,
          references_json jsonb not null default '[]'::jsonb,
          message_id text not null,
          metadata_json jsonb not null default '{}'::jsonb,
          status text not null default 'pending',
          attempts integer not null default 0,
          last_error text,
          next_attempt_at timestamptz not null default now(),
          sent_at timestamptz,
          provider_message_id text,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );

        create table if not exists kingestion_attachment_blobs (
          id text primary key,
          case_id text,
          uploaded_by_user_id text,
          file_name text not null,
          mime_type text not null,
          size_bytes integer not null,
          content_base64 text not null,
          created_at timestamptz not null default now()
        );

        create table if not exists kingestion_rate_limits (
          scope text not null,
          subject_key text not null,
          bucket_start bigint not null,
          count integer not null default 1,
          expires_at timestamptz not null,
          updated_at timestamptz not null default now(),
          primary key (scope, subject_key, bucket_start)
        );
      `);

      await runOptionalSchemaDdl(`
        create index if not exists kingestion_cases_status_zone_idx
          on kingestion_cases (external_status, zone);

        create index if not exists kingestion_cases_updated_at_idx
          on kingestion_cases (updated_at desc);

        create index if not exists kingestion_cases_archived_at_idx
          on kingestion_cases (archived_at);

        create index if not exists kingestion_cases_reimbursement_state_idx
          on kingestion_cases (reimbursement_state);

        create index if not exists kingestion_cases_data_json_idx
          on kingestion_cases using gin (data_json jsonb_path_ops);
      `);

      await runOptionalSchemaDdl(`
        alter table kingestion_attachment_blobs
        add column if not exists uploaded_by_user_id text
      `);

      const initialState = getDefaultWorkspaceData();

      await queryDatabase(
        `
          insert into kingestion_workspace_state (key, data_json, updated_at)
          values ($1, $2::jsonb, now())
          on conflict (key) do nothing
        `,
        [WORKSPACE_ROW_KEY, JSON.stringify(initialState)]
      );

      await migrateWorkspaceCasesToCaseRows();
      await ensureKingestionRlsPolicies();
    })().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }

  return schemaReadyPromise;
}

async function getSystemSetting(namespace: string, key: string, client?: PoolClient) {
  await ensureKingestionSchema();
  const runner = client ?? pool;
  const result = await runner.query<SystemSettingRow>(
    `
      select namespace, key, value_json, description, updated_at
      from kingestion_system_settings
      where namespace = $1 and key = $2
      limit 1
    `,
    [namespace, key]
  );

  return result.rows[0] ?? null;
}

async function upsertSystemSetting(args: {
  namespace: string;
  key: string;
  value: unknown;
  description: string;
  client?: PoolClient;
}) {
  await ensureKingestionSchema();
  const runner = args.client ?? pool;

  await runner.query(
    `
      insert into kingestion_system_settings (namespace, key, value_json, description, updated_at)
      values ($1, $2, $3::jsonb, $4, now())
      on conflict (namespace, key)
      do update set
        value_json = excluded.value_json,
        description = excluded.description,
        updated_at = now()
    `,
    [args.namespace, args.key, JSON.stringify(args.value), args.description]
  );
}

export async function getKingestionSystemSetting(namespace: string, key: string, client?: PoolClient) {
  return getSystemSetting(namespace, key, client);
}

export async function upsertKingestionSystemSetting(args: {
  namespace: string;
  key: string;
  value: unknown;
  description: string;
  client?: PoolClient;
}) {
  await upsertSystemSetting(args);
}

export async function withKingestionAdvisoryLock<T>(
  lockName: string,
  onLocked: () => T | Promise<T>,
  onAcquired: () => Promise<T>
) {
  await ensureKingestionSchema();
  const owner = createId("lock");
  const leaseSeconds = getPositiveIntegerEnv("KINGESTION_AUTOMATION_LOCK_SECONDS", 10 * 60);
  const result = await queryDatabase<{ lock_owner: string }>(
    `
      insert into kingestion_runtime_locks (lock_name, lock_owner, expires_at, updated_at)
      values ($1, $2, now() + ($3::integer * interval '1 second'), now())
      on conflict (lock_name)
      do update set
        lock_owner = excluded.lock_owner,
        expires_at = excluded.expires_at,
        updated_at = now()
      where kingestion_runtime_locks.expires_at <= now()
      returning lock_owner
    `,
    [lockName, owner, leaseSeconds]
  );

  if (result.rows[0]?.lock_owner !== owner) {
    return await onLocked();
  }

  try {
    return await onAcquired();
  } finally {
    await pool
      .query("delete from kingestion_runtime_locks where lock_name = $1 and lock_owner = $2", [lockName, owner])
      .catch(() => undefined);
  }
}

export async function queueKingestionEmail(args: {
  dedupeKey: string;
  to: string | string[];
  cc?: string | string[];
  subject: string;
  text: string;
  html?: string | null;
  inReplyTo?: string | null;
  references?: string[];
  metadata?: Record<string, unknown>;
}) {
  await ensureKingestionSchema();
  const to = (Array.isArray(args.to) ? args.to : [args.to]).map((entry) => entry.trim()).filter(Boolean);
  const cc = (Array.isArray(args.cc) ? args.cc : args.cc ? [args.cc] : []).map((entry) => entry.trim()).filter(Boolean);

  if (to.length === 0) {
    throw new WorkspaceHttpError("No se puede encolar un correo sin destinatario.", 400);
  }

  const result = await queryDatabase<EmailOutboxRow>(
    `
      insert into kingestion_email_outbox (
        id,
        dedupe_key,
        to_json,
        cc_json,
        subject,
        text_body,
        html_body,
        in_reply_to,
        references_json,
        message_id,
        metadata_json,
        status,
        next_attempt_at,
        created_at,
        updated_at
      )
      values ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8, $9::jsonb, $10, $11::jsonb, 'pending', now(), now(), now())
      on conflict (dedupe_key) do update set updated_at = kingestion_email_outbox.updated_at
      returning id, dedupe_key, to_json, cc_json, subject, text_body, html_body, in_reply_to, references_json, message_id, metadata_json, status, attempts
    `,
    [
      createId("email"),
      args.dedupeKey,
      JSON.stringify(to),
      JSON.stringify(cc),
      args.subject.trim(),
      args.text,
      args.html || null,
      args.inReplyTo || null,
      JSON.stringify(args.references ?? []),
      createDeterministicMessageId(args.dedupeKey),
      JSON.stringify(args.metadata ?? {})
    ]
  );

  return normalizeEmailOutboxRow(result.rows[0]);
}

export async function claimDueKingestionEmails(limit = 20) {
  await ensureKingestionSchema();
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const staleSeconds = getPositiveIntegerEnv("KINGESTION_EMAIL_SENDING_STALE_SECONDS", 20 * 60);
  const result = await queryDatabase<EmailOutboxRow>(
    `
      with next_emails as (
        select id
        from kingestion_email_outbox
        where
          (
            status in ('pending', 'error')
            and next_attempt_at <= now()
          )
          or (
            status = 'sending'
            and updated_at <= now() - ($2::integer * interval '1 second')
          )
        order by created_at asc
        limit $1
        for update skip locked
      )
      update kingestion_email_outbox
      set
        status = 'sending',
        attempts = attempts + 1,
        updated_at = now()
      where id in (select id from next_emails)
      returning id, dedupe_key, to_json, cc_json, subject, text_body, html_body, in_reply_to, references_json, message_id, metadata_json, status, attempts
    `,
    [safeLimit, staleSeconds]
  );

  return result.rows.map(normalizeEmailOutboxRow);
}

export async function markKingestionEmailSent(args: {
  id: string;
  providerMessageId?: string | null;
}) {
  await ensureKingestionSchema();
  await queryDatabase(
    `
      update kingestion_email_outbox
      set
        status = 'sent',
        sent_at = now(),
        provider_message_id = $2,
        last_error = null,
        updated_at = now()
      where id = $1
    `,
    [args.id, args.providerMessageId ?? null]
  );
}

export async function markKingestionEmailFailed(args: {
  id: string;
  error: string;
}) {
  await ensureKingestionSchema();
  const maxAttempts = getPositiveIntegerEnv("KINGESTION_EMAIL_MAX_ATTEMPTS", 5);
  const result = await queryDatabase<EmailOutboxRow>(
    `
      update kingestion_email_outbox
      set
        status = case when attempts >= $3 then 'failed' else 'error' end,
        last_error = $2,
        next_attempt_at = case
          when attempts >= $3 then next_attempt_at
          else now() + (least(3600, greatest(1, attempts) * 60)::integer * interval '1 second')
        end,
        updated_at = now()
      where id = $1
      returning id, dedupe_key, to_json, cc_json, subject, text_body, html_body, in_reply_to, references_json, message_id, metadata_json, status, attempts, last_error, provider_message_id, sent_at, created_at, updated_at
    `,
    [args.id, args.error.slice(0, 1000), maxAttempts]
  );

  return result.rows[0] ? normalizeEmailOutboxRow(result.rows[0]) : null;
}

export async function listKingestionEmailHistory(
  limit = 100,
  filters: KingestionEmailHistoryFilters = {}
): Promise<KingestionEmailHistoryItem[]> {
  await ensureKingestionSchema();
  const safeLimit = Math.min(Math.max(limit, 1), 300);
  const result = await queryDatabase<EmailOutboxRow>(
    `
      select
        id,
        dedupe_key,
        to_json,
        cc_json,
        subject,
        text_body,
        html_body,
        in_reply_to,
        references_json,
        message_id,
        metadata_json,
        status,
        attempts,
        last_error,
        provider_message_id,
        sent_at,
        created_at,
        updated_at
      from kingestion_email_outbox
      where ($2::text is null or metadata_json ->> 'caseId' = $2)
      order by created_at desc
      limit $1
    `,
    [safeLimit, filters.caseId?.trim() || null]
  );

  return result.rows.map(normalizeEmailHistoryRow);
}

export async function saveKingestionAttachmentBlob(args: {
  caseId?: string | null;
  uploadedByUserId?: string | null;
  name: string;
  mimeType: string;
  content: Buffer;
}) {
  await ensureKingestionSchema();
  const sizeBytes = args.content.byteLength;
  const maxBytes = getAttachmentMaxBytes();

  if (sizeBytes > maxBytes) {
    throw new WorkspaceHttpError(
      `El adjunto ${args.name} supera el limite permitido de ${Math.round(maxBytes / 1024 / 1024)} MB.`,
      413
    );
  }

  const blobId = createId("blob");
  await queryDatabase(
    `
      insert into kingestion_attachment_blobs (
        id,
        case_id,
        uploaded_by_user_id,
        file_name,
        mime_type,
        size_bytes,
        content_base64,
        created_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, now())
    `,
    [
      blobId,
      args.caseId ?? null,
      args.uploadedByUserId ?? null,
      args.name.trim() || "adjunto",
      args.mimeType.trim() || "application/octet-stream",
      sizeBytes,
      args.content.toString("base64")
    ]
  );

  return {
    id: blobId,
    previewUrl: `/api/case-attachments/${blobId}`,
    sizeBytes
  };
}

export async function getKingestionAttachmentBlob(blobId: string) {
  await ensureKingestionSchema();
  const result = await queryDatabase<AttachmentBlobRow>(
    `
      select id, case_id, uploaded_by_user_id, file_name, mime_type, size_bytes, content_base64, created_at
      from kingestion_attachment_blobs
      where id = $1
      limit 1
    `,
    [blobId]
  );
  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    caseId: row.case_id,
    uploadedByUserId: row.uploaded_by_user_id ?? null,
    name: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    content: Buffer.from(row.content_base64, "base64")
  };
}

function extractAttachmentBlobIds(attachments: Array<{ previewUrl?: string } | undefined> | undefined) {
  if (!attachments) {
    return [];
  }

  return Array.from(
    new Set(
      attachments
        .map((attachment) => attachment?.previewUrl?.match(/^\/api\/case-attachments\/(blob-[a-f0-9]+)/i)?.[1])
        .filter((blobId): blobId is string => Boolean(blobId))
    )
  );
}

async function bindKingestionAttachmentBlobsToCase(args: {
  caseId: string;
  attachments?: Array<{ previewUrl?: string } | undefined>;
  client?: PoolClient;
}) {
  const blobIds = extractAttachmentBlobIds(args.attachments);
  if (blobIds.length === 0) {
    return;
  }

  const runner = args.client ?? pool;
  await runner.query(
    `
      update kingestion_attachment_blobs
      set case_id = $1
      where id = any($2::text[])
        and (case_id is null or case_id = $1)
    `,
    [args.caseId, blobIds]
  );
}

export async function recordKingestionAutomationAudit(args: {
  actor?: OwnerDirectoryEntry | null;
  action: string;
  detail: string;
  entityId?: string;
  entityType?: InteractionEntityType;
}) {
  await ensureKingestionSchema();
  const client = await connectDatabaseClient();

  try {
    await client.query("begin");
    let workspaceData = await loadWorkspaceData(client);
    workspaceData = appendAuditLog(workspaceData, args.actor ?? createAutomationActor(), {
      entityType: args.entityType ?? "session",
      entityId: args.entityId ?? "kingestion-native-automation",
      action: args.action,
      detail: args.detail
    });
    await saveWorkspaceData(workspaceData, client);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function loadUsers(client?: PoolClient) {
  await ensureKingestionSchema();
  const runner = client ?? pool;
  const result = await runner.query<UserRow>(
    `
      select id, email, full_name, role, initials, is_active, permissions_json, password_hash
      from kingestion_users
      order by full_name asc
    `
  );
  return result.rows.map(normalizeOwner);
}

export async function listAutomationOwners() {
  return loadUsers();
}

async function loadWorkspaceData(
  client?: PoolClient,
  context: KingestionRlsContext = { system: true }
): Promise<WorkspaceDataState> {
  await ensureKingestionSchema();

  if (!client) {
    const dedicatedClient = await connectDatabaseClient();

    try {
      await dedicatedClient.query("begin");
      const workspaceData = await loadWorkspaceData(dedicatedClient, context);
      await dedicatedClient.query("commit");
      return workspaceData;
    } catch (error) {
      await dedicatedClient.query("rollback");
      throw error;
    } finally {
      dedicatedClient.release();
    }
  }

  await setKingestionRlsContext(client, context);
  const runner = client ?? pool;
  const result = await runner.query<{ data_json: WorkspaceDataState }>(
    `
      select data_json
      from kingestion_workspace_state
      where key = $1
    `,
    [WORKSPACE_ROW_KEY]
  );
  const caseRows = await runner.query<CaseRow>(
    `
      select id, data_json
      from kingestion_cases
      order by coalesce(updated_at, opened_at, persisted_at) desc, internal_number desc
    `
  );
  const cases = caseRows.rows.flatMap((row) => {
    const parsed = parseCaseRow(row);
    return parsed ? [parsed] : [];
  });
  const rawState = result.rows[0]?.data_json;
  const rawCases = Array.isArray(rawState?.cases) ? rawState.cases : [];

  if (cases.length > 0) {
    return normalizeWorkspaceData(rawState, {
      cases,
      useFallbackCases: false
    });
  }

  return normalizeWorkspaceData(rawState, {
    useFallbackCases: rawCases.length > 0 || !rawState
  });
}

async function saveWorkspaceData(state: WorkspaceDataState, client?: PoolClient) {
  if (!client) {
    const dedicatedClient = await connectDatabaseClient();

    try {
      await dedicatedClient.query("begin");
      await saveWorkspaceData(state, dedicatedClient);
      await dedicatedClient.query("commit");
      return;
    } catch (error) {
      await dedicatedClient.query("rollback");
      throw error;
    } finally {
      dedicatedClient.release();
    }
  }

  await setKingestionRlsContext(client, { system: true });
  const runner = client;
  const normalizedState = normalizeWorkspaceData(state, {
    cases: state.cases,
    useFallbackCases: false
  });
  const persistedWorkspaceState = stripCasesFromWorkspaceState(normalizedState);

  await runner.query(
    `
      insert into kingestion_workspace_state (key, data_json, updated_at)
      values ($1, $2::jsonb, now())
      on conflict (key) do update
        set data_json = excluded.data_json,
            updated_at = now()
    `,
    [WORKSPACE_ROW_KEY, JSON.stringify(persistedWorkspaceState)]
  );
  await replaceCaseRows(normalizedState.cases, client);
}

async function getUserByEmail(email: string, client?: PoolClient) {
  await ensureKingestionSchema();
  const runner = client ?? pool;
  const result = await runner.query<UserRow>(
    `
      select id, email, full_name, role, initials, is_active, permissions_json, password_hash
      from kingestion_users
      where lower(email) = lower($1)
      limit 1
    `,
    [email]
  );
  return result.rows[0] ? normalizeOwner(result.rows[0]) : null;
}

async function getUserRowByEmail(email: string, client?: PoolClient) {
  await ensureKingestionSchema();
  const runner = client ?? pool;
  const result = await runner.query<UserRow>(
    `
      select id, email, full_name, role, initials, is_active, permissions_json, password_hash
      from kingestion_users
      where lower(email) = lower($1)
      limit 1
    `,
    [email]
  );
  return result.rows[0] ?? null;
}

async function getUserRowById(userId: string, client?: PoolClient) {
  await ensureKingestionSchema();
  const runner = client ?? pool;
  const result = await runner.query<UserRow>(
    `
      select id, email, full_name, role, initials, is_active, permissions_json, password_hash
      from kingestion_users
      where id = $1
      limit 1
    `,
    [userId]
  );
  return result.rows[0] ?? null;
}

function assertModuleAccess(currentUser: OwnerDirectoryEntry, moduleKey: ModulePermissionKey) {
  if (currentUser.team === "ADMIN") {
    return;
  }

  if (!canAccessModule(currentUser.permissions, moduleKey)) {
    throw new WorkspaceHttpError("No tenes permiso para ver este modulo.", 403);
  }
}

function assertModuleManage(currentUser: OwnerDirectoryEntry, moduleKey: ModulePermissionKey) {
  if (currentUser.team === "ADMIN") {
    return;
  }

  if (!canManageModule(currentUser.permissions, moduleKey)) {
    throw new WorkspaceHttpError("No tenes permiso para modificar este modulo.", 403);
  }
}

export async function getWorkspaceSnapshot(currentUserId: string): Promise<WorkspaceSnapshot> {
  await ensureKingestionSchema();
  const client = await connectDatabaseClient();

  try {
    await client.query("begin");
    const owners = await loadUsers(client);
    const currentUser = owners.find((owner) => owner.id === currentUserId && owner.active);

    if (!currentUser) {
      throw new WorkspaceHttpError("La sesion actual no tiene un usuario activo.", 401);
    }

    let workspaceData = await loadWorkspaceData(client, { user: currentUser });
    const normalizedWorkspaceData = applyAutomaticCaseOwners(
      workspaceData,
      createAutomationActor(),
      owners,
      "Revision automatica al abrir Kingestion."
    );

    if (normalizedWorkspaceData !== workspaceData) {
      workspaceData = normalizedWorkspaceData;
      await saveWorkspaceData(workspaceData, client);
    }

    await client.query("commit");

    return buildWorkspaceSnapshotForUser(workspaceData, owners, currentUser);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getAuthSessionUser() {
  await ensureKingestionSchema();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const result = await queryDatabase<UserRow>(
    `
      select u.id, u.email, u.full_name, u.role, u.initials, u.is_active, u.permissions_json, u.password_hash
      from kingestion_sessions s
      join kingestion_users u on u.id = s.user_id
      where s.token_hash = $1
        and s.expires_at > now()
      limit 1
    `,
    [hashSessionToken(token)]
  );

  const userRow = result.rows[0];
  if (!userRow) {
    return null;
  }

  if (!userRow.is_active) {
    return null;
  }

  return normalizeOwner(userRow);
}

export async function requireSessionUser() {
  const user = await getAuthSessionUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function loginWithCredentials(email: string, password: string) {
  await ensureKingestionSchema();
  await queryDatabase(`delete from kingestion_sessions where expires_at <= now()`);
  const userRow = await getUserRowByEmail(email);

  if (!userRow || !verifyPassword(password, userRow.password_hash)) {
    throw new WorkspaceHttpError("Email o contrasena incorrectos.", 401);
  }

  if (!userRow.is_active) {
    throw new WorkspaceHttpError("Tu usuario esta inactivo. Pedi revision al administrador.", 403);
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  await queryDatabase(
    `
      insert into kingestion_sessions (id, user_id, token_hash, expires_at)
      values ($1, $2, $3, $4)
    `,
    [createId("session"), userRow.id, hashSessionToken(token), expiresAt.toISOString()]
  );

  await setSessionCookie(token, expiresAt);

  return normalizeOwner(userRow);
}

export async function logoutCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await queryDatabase(`delete from kingestion_sessions where token_hash = $1`, [hashSessionToken(token)]);
  }

  await clearSessionCookie();
}

export async function bootstrapAdminUser(input: { name: string; email: string; password: string }) {
  await ensureKingestionSchema();

  const existingUsers = await queryDatabase<{ total: string }>(`select count(*)::text as total from kingestion_users`);
  if (Number(existingUsers.rows[0]?.total ?? 0) > 0) {
    throw new WorkspaceHttpError("La plataforma ya tiene usuarios creados.", 409);
  }

  const userId = createId("user");
  await queryDatabase(
    `
      insert into kingestion_users (
        id,
        email,
        full_name,
        password_hash,
        role,
        initials,
        is_active,
        permissions_json
      )
      values ($1, $2, $3, $4, $5, $6, true, $7::jsonb)
    `,
    [
      userId,
      input.email.trim().toLowerCase(),
      input.name.trim(),
      hashPassword(input.password),
      "ADMIN",
      buildInitials(input.name),
      JSON.stringify(getDefaultPermissionsForRole("ADMIN"))
    ]
  );

  return loginWithCredentials(input.email, input.password);
}

export async function updateCurrentUserProfile(
  currentUserId: string,
  input: {
    name?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
  }
) {
  await ensureKingestionSchema();
  const client = await connectDatabaseClient();

  try {
    await client.query("begin");
    const currentRow = await getUserRowById(currentUserId, client);
    if (!currentRow || !currentRow.is_active) {
      throw new WorkspaceHttpError("La sesion actual no tiene un usuario activo.", 401);
    }

    const nextName = input.name?.trim() || currentRow.full_name;
    const nextEmail = input.email?.trim().toLowerCase() || currentRow.email;
    const wantsPasswordChange = Boolean(input.newPassword?.trim());

    if (nextName.length < 2) {
      throw new WorkspaceHttpError("El nombre debe tener al menos 2 caracteres.", 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      throw new WorkspaceHttpError("Ingresa un email valido.", 400);
    }

    const duplicatedEmail = await getUserRowByEmail(nextEmail, client);
    if (duplicatedEmail && duplicatedEmail.id !== currentUserId) {
      throw new WorkspaceHttpError("Ya existe otro usuario con ese email.", 409);
    }

    let nextPasswordHash: string | null = null;
    if (wantsPasswordChange) {
      if (!input.currentPassword || !verifyPassword(input.currentPassword, currentRow.password_hash)) {
        throw new WorkspaceHttpError("La contrasena actual no es correcta.", 403);
      }

      if ((input.newPassword ?? "").trim().length < 8) {
        throw new WorkspaceHttpError("La nueva contrasena debe tener al menos 8 caracteres.", 400);
      }

      nextPasswordHash = hashPassword(input.newPassword!.trim());
    }

    const updated = await client.query<UserRow>(
      `
        update kingestion_users
        set
          full_name = $2,
          email = $3,
          initials = $4,
          password_hash = coalesce($5, password_hash),
          updated_at = now()
        where id = $1
        returning id, email, full_name, role, initials, is_active, permissions_json, password_hash
      `,
      [currentUserId, nextName, nextEmail, buildInitials(nextName), nextPasswordHash]
    );

    let workspaceData = await loadWorkspaceData(client);
    const updatedUser = normalizeOwner(updated.rows[0]);
    workspaceData = appendAuditLog(workspaceData, updatedUser, {
      entityType: "user",
      entityId: currentUserId,
      action: "user-profile-updated",
      detail: "El usuario actualizo sus datos de perfil."
    });

    if (wantsPasswordChange) {
      workspaceData = appendAuditLog(workspaceData, updatedUser, {
        entityType: "user",
        entityId: currentUserId,
        action: "user-password-updated",
        detail: "El usuario actualizo su contrasena."
      });
    }

    await saveWorkspaceData(workspaceData, client);
    await client.query("commit");

    return updatedUser;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function hasBootstrapUser() {
  await ensureKingestionSchema();
  const result = await queryDatabase<{ total: string }>(`select count(*)::text as total from kingestion_users`);
  return Number(result.rows[0]?.total ?? 0) > 0;
}

export async function assertRateLimit(scope: string, subjectKey: string, limit: number, windowMs: number) {
  await ensureKingestionSchema();

  const bucketStart = Math.floor(Date.now() / windowMs) * windowMs;
  const expiresAt = new Date(bucketStart + windowMs * 2).toISOString();
  await queryDatabase(`delete from kingestion_rate_limits where expires_at <= now()`);
  const result = await queryDatabase<{ count: number }>(
    `
      insert into kingestion_rate_limits (scope, subject_key, bucket_start, count, expires_at, updated_at)
      values ($1, $2, $3, 1, $4, now())
      on conflict (scope, subject_key, bucket_start)
      do update
        set count = kingestion_rate_limits.count + 1,
            updated_at = now()
      returning count
    `,
    [scope, subjectKey, bucketStart, expiresAt]
  );

  if (Number(result.rows[0]?.count ?? 0) > limit) {
    throw new WorkspaceHttpError("Se supero el limite de intentos. Espera unos minutos e intenta nuevamente.", 429);
  }
}

function applyCreateCase(
  workspaceData: WorkspaceDataState,
  currentUser: OwnerDirectoryEntry,
  input: CreateCaseInput
) {
  const nowIso = new Date().toISOString();
  const nextNumber = getNextInternalCaseNumber(workspaceData.cases);
  const internalNumber = `RMA-${nextNumber}`;
  const caseId = `rma-${nextNumber}`;
  const nextAttachments = (input.attachments ?? []).map((attachment) => ({
    id: createId("attachment"),
    name: attachment.name.trim(),
    kind: attachment.kind || inferAttachmentKind(attachment.name),
    sizeLabel: attachment.sizeLabel,
    uploadedBy: currentUser.name,
    createdAt: nowIso,
    mimeType: attachment.mimeType,
      previewUrl: sanitizePreviewUrl(attachment.previewUrl)
  }));
  const initialTask = [
    {
      id: createId("task"),
      title: "Validar caso",
      description: "Revisar documentacion inicial y definir responsable activo.",
      type: "validation" as const,
      assignee: input.owner || "Sin asignar",
      priority: input.priority,
      dueAt: addDays(new Date(), getInitialTaskDueDays(input.priority)),
      state: "Pending" as const
    }
  ];
  const createdCase = normalizeCase({
    id: caseId,
    internalNumber,
    kingstonNumber: input.kingstonNumber.trim(),
    clientName: input.clientName.trim(),
    contactName: input.contactName.trim(),
    contactEmail: input.contactEmail.trim(),
    contactPhone: input.contactPhone.trim(),
    zone: input.zone,
    deliveryMode: input.deliveryMode,
    priority: input.priority,
    owner: input.owner.trim() || "Sin asignar",
    nextAction: input.nextAction.trim() || getNextActionCopy(input.externalStatus),
    externalStatus: input.externalStatus,
    internalSubstatus: getInitialSubstatus(input.externalStatus, input.zone),
    openedAt: nowIso,
    updatedAt: nowIso,
    slaDueAt: addDays(new Date(), getSlaDays(input.priority)),
    address: input.address.trim(),
    province: input.province.trim(),
    city: input.city.trim(),
    sku: input.sku.trim(),
    replacementSku: input.replacementSku?.trim() || null,
    productDescription: input.productDescription.trim(),
    quantity: input.quantity,
    failureDescription: input.failureDescription.trim(),
    origin: input.origin,
    observations: input.observations.trim(),
    banking:
      input.banking && Object.values(input.banking).some((value) => (value ?? "").trim().length > 0)
        ? {
            bankName: input.banking.bankName?.trim() ?? "",
            accountHolder: input.banking.accountHolder?.trim() ?? "",
            cuit: input.banking.cuit?.trim() ?? "",
            cbu: input.banking.cbu?.trim() ?? "",
            alias: input.banking.alias?.trim() ?? "",
            accountNumber: input.banking.accountNumber?.trim() ?? ""
          }
        : undefined,
    logistics: {
      mode: input.deliveryMode,
      address: input.deliveryMode === "Pickup" ? "Mostrador central ANYX" : input.address.trim(),
      transporter: null,
      guideNumber: null,
      trackingUrl: null,
      dispatchDate: null,
      deliveredDate: null,
      shippingCost: null,
      reimbursementState:
        isReimbursementZone(input.zone) && hasReachedReimbursementTrigger(input.externalStatus, input.zone)
          ? nextAttachments.some((attachment) => attachment.kind === "proof" || attachment.kind === "photo")
            ? "Requested"
            : "Pending"
          : "Not applicable"
    },
    procurement: {
      localStock: input.externalStatus === "Pedido Kingston" ? "Unavailable" : "Pending",
      wholesalerStock: input.externalStatus === "Pedido Kingston" ? "Unavailable" : "Pending",
      wholesalerName: null,
      requiresKingstonOrder: input.externalStatus === "Pedido Kingston",
      kingstonRequestedAt: input.externalStatus === "Pedido Kingston" ? nowIso : null,
      receivedFromUsaAt: null,
      releasedByPurchasing: false,
      releasedAt: null,
      movedToRmaWarehouse: false,
      movedToRmaWarehouseAt: null
    },
    tasks: initialTask,
    comments: [],
    attachments: nextAttachments,
    events: [
      {
        id: createId("event"),
        kind: "status-change",
        title: "Caso creado",
        detail: `${internalNumber} se creo en ${input.externalStatus} para ${input.clientName.trim()}.`,
        actor: currentUser.name,
        createdAt: nowIso
      }
    ]
  });

  return {
    workspaceData: appendAuditLog(
      {
        ...workspaceData,
        cases: [createdCase, ...workspaceData.cases]
      },
      currentUser,
      {
        entityType: "case",
        entityId: caseId,
        action: "case-created",
        detail: `Se creo ${internalNumber} para ${createdCase.clientName}.`
      }
    ),
    createdCaseId: caseId
  };
}

function applyAddCaseAttachment(
  workspaceData: WorkspaceDataState,
  currentUser: OwnerDirectoryEntry,
  caseId: string,
  input: CaseAttachmentInput
) {
  const targetCase = workspaceData.cases.find((entry) => entry.id === caseId);
  if (!targetCase) {
    throw new WorkspaceHttpError("No pude encontrar el caso solicitado.", 404);
  }
  assertCaseIsMutable(targetCase);

  const now = new Date().toISOString();
  const nextCases = workspaceData.cases.map((entry): KingstonCase => {
    if (entry.id !== caseId) {
      return entry;
    }

    const nextAttachment: CaseAttachment = {
      id: createId("attachment"),
      name: input.name.trim(),
      kind: input.kind || inferAttachmentKind(input.name),
      sizeLabel: input.sizeLabel,
      uploadedBy: currentUser.name,
      createdAt: now,
      mimeType: input.mimeType,
      previewUrl: sanitizePreviewUrl(input.previewUrl)
    };

    return {
      ...entry,
      updatedAt: now,
      attachments: [nextAttachment, ...entry.attachments],
      logistics: {
        ...entry.logistics,
        reimbursementState:
          shouldTrackReimbursement(entry) &&
          (nextAttachment.kind === "proof" || nextAttachment.kind === "photo")
            ? "Requested"
            : entry.logistics.reimbursementState
      },
      events: [
        {
          id: createId("event"),
          kind: "attachment",
          title: "Adjunto cargado",
          detail: `${nextAttachment.name} se sumo al caso.`,
          actor: currentUser.name,
          createdAt: now
        },
        ...entry.events
      ]
    };
  });

  return appendAuditLog(
    {
      ...workspaceData,
      cases: nextCases
    },
    currentUser,
    {
      entityType: "case",
      entityId: caseId,
      action: "case-attachment-added",
      detail: `${targetCase.internalNumber} recibio el adjunto ${input.name.trim()}.`
    }
  );
}

function applyRemoveCaseAttachment(
  workspaceData: WorkspaceDataState,
  currentUser: OwnerDirectoryEntry,
  caseId: string,
  attachmentId: string
) {
  const targetCase = workspaceData.cases.find((entry) => entry.id === caseId);
  const targetAttachment = targetCase?.attachments.find((attachment) => attachment.id === attachmentId);
  if (!targetCase || !targetAttachment) {
    throw new WorkspaceHttpError("No pude encontrar el adjunto solicitado.", 404);
  }
  assertCaseIsMutable(targetCase);

  const now = new Date().toISOString();
  const nextCases = workspaceData.cases.map((entry): KingstonCase => {
    if (entry.id !== caseId) {
      return entry;
    }

    const remainingAttachments = entry.attachments.filter((attachment) => attachment.id !== attachmentId);
    const hasProofAttachment = remainingAttachments.some(
      (attachment) => attachment.kind === "proof" || attachment.kind === "photo"
    );

    return {
      ...entry,
      updatedAt: now,
      attachments: remainingAttachments,
      logistics: {
        ...entry.logistics,
        reimbursementState:
          !hasProofAttachment && entry.logistics.reimbursementState === "Requested"
            ? "Pending"
            : entry.logistics.reimbursementState
      },
      events: [
        {
          id: createId("event"),
          kind: "attachment",
          title: "Adjunto eliminado",
          detail: `${targetAttachment.name} se elimino del caso.`,
          actor: currentUser.name,
          createdAt: now
        },
        ...entry.events
      ]
    };
  });

  return appendAuditLog(
    {
      ...workspaceData,
      cases: nextCases
    },
    currentUser,
    {
      entityType: "case",
      entityId: caseId,
      action: "case-attachment-removed",
      detail: `${targetCase.internalNumber} elimino el adjunto ${targetAttachment.name}.`
    }
  );
}

function applyAddCaseComment(
  workspaceData: WorkspaceDataState,
  currentUser: OwnerDirectoryEntry,
  caseId: string,
  input: {
    body: string;
    internal?: boolean;
  }
) {
  const targetCase = workspaceData.cases.find((entry) => entry.id === caseId);
  if (!targetCase) {
    throw new WorkspaceHttpError("No pude encontrar el caso solicitado.", 404);
  }
  assertCaseIsMutable(targetCase);

  const now = new Date().toISOString();
  const nextBody = input.body.trim();
  if (!nextBody) {
    throw new WorkspaceHttpError("El comentario no puede estar vacio.", 400);
  }

  const nextCases = workspaceData.cases.map((entry): KingstonCase => {
    if (entry.id !== caseId) {
      return entry;
    }

    return {
      ...entry,
      updatedAt: now,
      comments: [
        {
          id: createId("comment"),
          author: currentUser.name,
          body: nextBody,
          internal: input.internal ?? true,
          createdAt: now
        },
        ...entry.comments
      ],
      events: [
        {
          id: createId("event"),
          kind: "comment",
          title: input.internal === false ? "Comentario externo agregado" : "Comentario interno agregado",
          detail: nextBody,
          actor: currentUser.name,
          createdAt: now
        },
        ...entry.events
      ]
    };
  });

  return appendAuditLog(
    {
      ...workspaceData,
      cases: nextCases
    },
    currentUser,
    {
      entityType: "case",
      entityId: caseId,
      action: "case-comment-added",
      detail: `${targetCase.internalNumber} recibio un comentario automatizado.`
    }
  );
}

function applyUpdateCaseLogistics(
  workspaceData: WorkspaceDataState,
  currentUser: OwnerDirectoryEntry,
  caseId: string,
  input: AutomationCasePatch["logistics"]
) {
  const targetCase = workspaceData.cases.find((entry) => entry.id === caseId);
  if (!targetCase) {
    throw new WorkspaceHttpError("No pude encontrar el caso solicitado.", 404);
  }
  assertCaseIsMutable(targetCase);

  if (!input) {
    return workspaceData;
  }

  const now = new Date().toISOString();
  const nextCases = workspaceData.cases.map((entry): KingstonCase => {
    if (entry.id !== caseId) {
      return entry;
    }

    const nextLogistics = {
      ...entry.logistics,
      mode: input.mode ?? entry.logistics.mode,
      address: input.address?.trim() || entry.logistics.address,
      transporter:
        input.transporter !== undefined ? input.transporter?.trim() || null : entry.logistics.transporter,
      guideNumber: input.guideNumber !== undefined ? input.guideNumber?.trim() || null : entry.logistics.guideNumber,
      trackingUrl:
        input.trackingUrl !== undefined ? sanitizeTrackingUrl(input.trackingUrl) : sanitizeTrackingUrl(entry.logistics.trackingUrl),
      dispatchDate: input.dispatchDate !== undefined ? input.dispatchDate || null : entry.logistics.dispatchDate,
      deliveredDate: input.deliveredDate !== undefined ? input.deliveredDate || null : entry.logistics.deliveredDate,
      shippingCost:
        input.shippingCost !== undefined ? input.shippingCost?.trim() || null : entry.logistics.shippingCost,
      reimbursementState: input.reimbursementState ?? entry.logistics.reimbursementState
    };

    return normalizeCase({
      ...entry,
      deliveryMode: nextLogistics.mode,
      logistics: nextLogistics,
      updatedAt: now,
      events: [
        {
          id: createId("event"),
          kind: "logistics",
          title: "Logistica actualizada",
          detail: "Se actualizaron datos logisticos del caso.",
          actor: currentUser.name,
          createdAt: now
        },
        ...entry.events
      ]
    });
  });

  return appendAuditLog(
    {
      ...workspaceData,
      cases: nextCases
    },
    currentUser,
    {
      entityType: "case",
      entityId: caseId,
      action: "case-logistics-updated",
      detail: `${targetCase.internalNumber} actualizo datos logisticos.`
    }
  );
}

function applyUpdateCaseProcurement(
  workspaceData: WorkspaceDataState,
  currentUser: OwnerDirectoryEntry,
  caseId: string,
  input: AutomationCasePatch["procurement"]
) {
  const targetCase = workspaceData.cases.find((entry) => entry.id === caseId);
  if (!targetCase) {
    throw new WorkspaceHttpError("No pude encontrar el caso solicitado.", 404);
  }
  assertCaseIsMutable(targetCase);

  if (!input) {
    return workspaceData;
  }

  const now = new Date().toISOString();
  const nextCases = workspaceData.cases.map((entry): KingstonCase => {
    if (entry.id !== caseId) {
      return entry;
    }

    return normalizeCase({
      ...entry,
      procurement: {
        ...entry.procurement,
        localStock: input.localStock ?? entry.procurement.localStock,
        wholesalerStock: input.wholesalerStock ?? entry.procurement.wholesalerStock,
        wholesalerName:
          input.wholesalerName !== undefined ? input.wholesalerName?.trim() || null : entry.procurement.wholesalerName,
        requiresKingstonOrder: input.requiresKingstonOrder ?? entry.procurement.requiresKingstonOrder,
        kingstonRequestedAt:
          input.kingstonRequestedAt !== undefined
            ? input.kingstonRequestedAt || null
            : entry.procurement.kingstonRequestedAt,
        receivedFromUsaAt:
          input.receivedFromUsaAt !== undefined ? input.receivedFromUsaAt || null : entry.procurement.receivedFromUsaAt,
        releasedByPurchasing: input.releasedByPurchasing ?? entry.procurement.releasedByPurchasing,
        releasedAt: input.releasedAt !== undefined ? input.releasedAt || null : entry.procurement.releasedAt,
        movedToRmaWarehouse: input.movedToRmaWarehouse ?? entry.procurement.movedToRmaWarehouse,
        movedToRmaWarehouseAt:
          input.movedToRmaWarehouseAt !== undefined
            ? input.movedToRmaWarehouseAt || null
            : entry.procurement.movedToRmaWarehouseAt
      },
      updatedAt: now,
      events: [
        {
          id: createId("event"),
          kind: "procurement",
          title: "Abastecimiento actualizado",
          detail: "La automatizacion actualizo datos de compras y stock.",
          actor: currentUser.name,
          createdAt: now
        },
        ...entry.events
      ]
    });
  });

  return appendAuditLog(
    {
      ...workspaceData,
      cases: nextCases
    },
    currentUser,
    {
      entityType: "case",
      entityId: caseId,
      action: "case-procurement-updated",
      detail: `${targetCase.internalNumber} actualizo datos de abastecimiento desde automatizacion.`
    }
  );
}

function applyUpdateReplacementSku(
  workspaceData: WorkspaceDataState,
  currentUser: OwnerDirectoryEntry,
  caseId: string,
  replacementSku: string
) {
  const targetCase = workspaceData.cases.find((entry) => entry.id === caseId);
  if (!targetCase) {
    throw new WorkspaceHttpError("No pude encontrar el caso solicitado.", 404);
  }
  assertCaseIsMutable(targetCase);

  const now = new Date().toISOString();
  const normalizedReplacementSku = replacementSku.trim() || null;

  const nextCases = workspaceData.cases.map((entry): KingstonCase => {
    if (entry.id !== caseId) {
      return entry;
    }

    return {
      ...entry,
      replacementSku: normalizedReplacementSku,
      updatedAt: now,
      events: [
        {
          id: createId("event"),
          kind: "procurement",
          title: "SKU de reemplazo actualizado",
          detail: normalizedReplacementSku
            ? `Se definio ${normalizedReplacementSku} como SKU de reemplazo.`
            : "Se limpio el SKU de reemplazo del caso.",
          actor: currentUser.name,
          createdAt: now
        },
        ...entry.events
      ]
    };
  });

  return appendAuditLog(
    {
      ...workspaceData,
      cases: nextCases
    },
    currentUser,
    {
      entityType: "case",
      entityId: caseId,
      action: "case-replacement-sku-updated",
      detail: normalizedReplacementSku
        ? `${targetCase.internalNumber} ahora usa ${normalizedReplacementSku} como SKU de reemplazo.`
        : `Se removio el SKU de reemplazo de ${targetCase.internalNumber}.`
    }
  );
}

function applyCompleteReimbursement(workspaceData: WorkspaceDataState, currentUser: OwnerDirectoryEntry, caseId: string) {
  if (!canManageReimbursementForUser(currentUser)) {
    throw new WorkspaceHttpError("No tenes permiso para completar reintegros.", 403);
  }

  const targetCase = workspaceData.cases.find((entry) => entry.id === caseId);
  if (!targetCase) {
    throw new WorkspaceHttpError("No pude encontrar el caso solicitado.", 404);
  }
  assertCaseIsMutable(targetCase);

  const now = new Date().toISOString();
  const nextCases = workspaceData.cases.map((entry): KingstonCase => {
    if (entry.id !== caseId) {
      return entry;
    }

    return {
      ...entry,
      updatedAt: now,
      logistics: {
        ...entry.logistics,
        reimbursementState: "Completed"
      },
      events: [
        {
          id: createId("event"),
          kind: "logistics",
          title: "Reintegro completado",
          detail: "El reintegro quedo marcado como completado.",
          actor: currentUser.name,
          createdAt: now
        },
        ...entry.events
      ]
    };
  });

  return appendAuditLog(
    {
      ...workspaceData,
      cases: nextCases
    },
    currentUser,
    {
      entityType: "case",
      entityId: caseId,
      action: "case-reimbursement-completed",
      detail: `Se completo el reintegro de ${targetCase.internalNumber}.`
    }
  );
}

function applyRequestReimbursementMissingData(
  workspaceData: WorkspaceDataState,
  currentUser: OwnerDirectoryEntry,
  caseId: string
) {
  if (!canManageReimbursementForUser(currentUser)) {
    throw new WorkspaceHttpError("No tenes permiso para solicitar datos de reintegro.", 403);
  }

  const targetCase = workspaceData.cases.find((entry) => entry.id === caseId);
  if (!targetCase) {
    throw new WorkspaceHttpError("No pude encontrar el caso solicitado.", 404);
  }
  assertCaseIsMutable(targetCase);

  if (targetCase.logistics.reimbursementState === "Completed") {
    throw new WorkspaceHttpError("El reintegro ya esta completado.", 409);
  }

  const now = new Date().toISOString();
  const nextCases = workspaceData.cases.map((entry): KingstonCase => {
    if (entry.id !== caseId) {
      return entry;
    }

    return {
      ...entry,
      updatedAt: now,
      events: [
        {
          id: createId("event"),
          kind: "logistics",
          title: "Datos faltantes solicitados",
          detail: "Se solicito al cliente informacion faltante para poder realizar el reintegro.",
          actor: currentUser.name,
          createdAt: now
        },
        ...entry.events
      ]
    };
  });

  return appendAuditLog(
    {
      ...workspaceData,
      cases: nextCases
    },
    currentUser,
    {
      entityType: "case",
      entityId: caseId,
      action: "case-reimbursement-missing-data-requested",
      detail: `Se solicitaron datos faltantes para el reintegro de ${targetCase.internalNumber}.`
    }
  );
}

function applyMarkReimbursementInProcess(
  workspaceData: WorkspaceDataState,
  currentUser: OwnerDirectoryEntry,
  caseId: string
) {
  if (!canManageReimbursementForUser(currentUser)) {
    throw new WorkspaceHttpError("No tenes permiso para marcar reintegros en proceso.", 403);
  }

  const targetCase = workspaceData.cases.find((entry) => entry.id === caseId);
  if (!targetCase) {
    throw new WorkspaceHttpError("No pude encontrar el caso solicitado.", 404);
  }
  assertCaseIsMutable(targetCase);

  if (targetCase.logistics.reimbursementState === "Completed") {
    throw new WorkspaceHttpError("El reintegro ya esta completado.", 409);
  }

  const now = new Date().toISOString();
  const nextCases = workspaceData.cases.map((entry): KingstonCase => {
    if (entry.id !== caseId) {
      return entry;
    }

    return {
      ...entry,
      updatedAt: now,
      logistics: {
        ...entry.logistics,
        reimbursementState: "In process"
      },
      events: [
        {
          id: createId("event"),
          kind: "logistics",
          title: "Reintegro en proceso",
          detail: "El reintegro quedo marcado como en proceso.",
          actor: currentUser.name,
          createdAt: now
        },
        ...entry.events
      ]
    };
  });

  return appendAuditLog(
    {
      ...workspaceData,
      cases: nextCases
    },
    currentUser,
    {
      entityType: "case",
      entityId: caseId,
      action: "case-reimbursement-in-process",
      detail: `Se marco en proceso el reintegro de ${targetCase.internalNumber}.`
    }
  );
}

function applyAssignCaseOwner(
  workspaceData: WorkspaceDataState,
  currentUser: OwnerDirectoryEntry,
  caseId: string,
  ownerName: string
) {
  const targetCase = workspaceData.cases.find((entry) => entry.id === caseId);
  if (!targetCase) {
    throw new WorkspaceHttpError("No pude encontrar el caso solicitado.", 404);
  }
  assertCaseIsMutable(targetCase);

  if (targetCase.owner === ownerName) {
    return workspaceData;
  }

  const now = new Date().toISOString();
  const nextCases: KingstonCase[] = workspaceData.cases.map((entry): KingstonCase =>
    entry.id === caseId
      ? {
          ...entry,
          owner: ownerName,
          updatedAt: now,
          events: [
            {
              id: createId("event"),
              kind: "task",
              title: "Responsable actualizado",
              detail: `El caso quedo asignado a ${ownerName}.`,
              actor: currentUser.name,
              createdAt: now
            },
            ...entry.events
          ]
        }
      : entry
  );

  return appendAuditLog(
    {
      ...workspaceData,
      cases: nextCases
    },
    currentUser,
    {
      entityType: "case",
      entityId: caseId,
      action: "case-owner-updated",
      detail: `Se asigno ${targetCase.internalNumber} a ${ownerName}.`
    }
  );
}

function applyUpdateCaseStatus(
  workspaceData: WorkspaceDataState,
  currentUser: OwnerDirectoryEntry,
  caseId: string,
  status: KingstonCase["externalStatus"]
) {
  const targetCase = workspaceData.cases.find((entry) => entry.id === caseId);
  if (!targetCase) {
    throw new WorkspaceHttpError("No pude encontrar el caso solicitado.", 404);
  }
  assertCaseIsMutable(targetCase);

  if (targetCase.externalStatus === status) {
    return workspaceData;
  }

  const now = new Date().toISOString();
  const nextCases = workspaceData.cases.map((entry) => {
    if (entry.id !== caseId) return entry;

    const nextTasks = entry.tasks.map((task) => {
      if (status === "Realizado" || status === "Vencido" || status === "Cerrado") {
        return {
          ...task,
          state: "Completed" as const
        };
      }

      return task;
    });

    return normalizeCase({
      ...entry,
      externalStatus: status,
      internalSubstatus: getInitialSubstatus(status, entry.zone),
      nextAction: getNextActionCopy(status),
      updatedAt: now,
      logistics: {
        ...entry.logistics,
        reimbursementState:
          entry.logistics.reimbursementState === "Completed"
            ? "Completed"
            : entry.logistics.reimbursementState === "In process"
              ? "In process"
              : isReimbursementZone(entry.zone) &&
                  (hasReachedReimbursementTrigger(status, entry.zone) ||
                    entry.logistics.reimbursementState === "Pending" ||
                    entry.logistics.reimbursementState === "Requested")
                ? entry.attachments.some((attachment) => attachment.kind === "proof" || attachment.kind === "photo")
                  ? "Requested"
                  : "Pending"
                : "Not applicable",
        dispatchDate:
          status === "Producto enviado" && !entry.logistics.dispatchDate ? now : entry.logistics.dispatchDate,
        deliveredDate:
          status === "Realizado" && !entry.logistics.deliveredDate ? now : entry.logistics.deliveredDate
      },
      tasks: nextTasks,
      events: [
        {
          id: createId("event"),
          kind: "status-change",
          title: `Estado actualizado a ${status}`,
          detail: `El caso avanzo desde ${targetCase.externalStatus} hacia ${status}.`,
          actor: currentUser.name,
          createdAt: now
        },
        ...entry.events
      ]
    });
  });

  return appendAuditLog(
    {
      ...workspaceData,
      cases: nextCases
    },
    currentUser,
    {
      entityType: "case",
      entityId: caseId,
      action: "case-status-updated",
      detail: `${targetCase.internalNumber} cambio de ${targetCase.externalStatus} a ${status}.`
    }
  );
}

function applyCompleteQueueStep(
  workspaceData: WorkspaceDataState,
  currentUser: OwnerDirectoryEntry,
  caseId: string,
  options?: {
    nextStatus?: KingstonCase["externalStatus"];
    guideNumber?: string;
  }
) {
  const targetCase = workspaceData.cases.find((entry) => entry.id === caseId);
  if (!targetCase) {
    throw new WorkspaceHttpError("No pude encontrar el caso solicitado.", 404);
  }
  assertCaseIsMutable(targetCase);

  const isPurchasingQueueStep =
    targetCase.externalStatus === "Liberar mercaderia" ||
    targetCase.externalStatus === "OV creada" ||
    targetCase.externalStatus === "Pedido Kingston";
  const isTechnicalQueueStep =
    targetCase.externalStatus === "Informado" || targetCase.externalStatus === "Pedido deposito y etiquetado";

  if (!isPurchasingQueueStep && !isTechnicalQueueStep) {
    throw new WorkspaceHttpError("Este caso no tiene una accion pendiente de cierre sectorial.", 409);
  }

  if (
    currentUser.team !== "ADMIN" &&
    !canManageModule(currentUser.permissions, isPurchasingQueueStep ? "pending-purchases" : "pending-service")
  ) {
      throw new WorkspaceHttpError("No tenes permiso para completar esta cola sectorial.", 403);
  }

  const nextOptions = getQueueCompletionOptions(targetCase);
  if (nextOptions.length === 0) {
    throw new WorkspaceHttpError("No pude determinar la siguiente etapa para este caso.", 409);
  }

  const nextStatus = options?.nextStatus ?? nextOptions[0];
  if (!nextOptions.includes(nextStatus)) {
    throw new WorkspaceHttpError("La siguiente etapa elegida no aplica para este caso.", 409);
  }

  let nextWorkspaceData = workspaceData;
  const normalizedGuideNumber = options?.guideNumber?.trim();
  const needsDispatchLogistics =
    nextStatus === "Producto enviado" &&
    targetCase.zone === "Interior / Gran Buenos Aires" &&
    targetCase.externalStatus === "Pedido deposito y etiquetado";

  if (needsDispatchLogistics || options?.guideNumber !== undefined) {
    nextWorkspaceData = applyUpdateCaseLogistics(nextWorkspaceData, currentUser, caseId, {
      guideNumber: options?.guideNumber !== undefined ? normalizedGuideNumber || null : undefined,
      dispatchDate: needsDispatchLogistics && !targetCase.logistics.dispatchDate ? new Date().toISOString() : undefined
    });
  }

  return applyUpdateCaseStatus(nextWorkspaceData, currentUser, caseId, nextStatus);
}

function applyDeleteCase(workspaceData: WorkspaceDataState, currentUser: OwnerDirectoryEntry, caseId: string) {
  if (currentUser.team !== "ADMIN") {
    throw new WorkspaceHttpError("Solo el administrador puede eliminar casos.", 403);
  }

  const targetCase = workspaceData.cases.find((entry) => entry.id === caseId);
  if (!targetCase) {
    throw new WorkspaceHttpError("No pude encontrar el caso solicitado.", 404);
  }

  return appendAuditLog(
    {
      ...workspaceData,
      cases: workspaceData.cases.filter((entry) => entry.id !== caseId)
    },
    currentUser,
    {
      entityType: "case",
      entityId: caseId,
      action: "case-deleted",
      detail: `Se elimino ${targetCase.internalNumber}.`
    }
  );
}

function applyArchiveCase(workspaceData: WorkspaceDataState, currentUser: OwnerDirectoryEntry, caseId: string) {
  if (currentUser.team !== "ADMIN") {
    throw new WorkspaceHttpError("Solo el administrador puede archivar casos.", 403);
  }

  const targetCase = workspaceData.cases.find((entry) => entry.id === caseId);
  if (!targetCase) {
    throw new WorkspaceHttpError("No pude encontrar el caso solicitado.", 404);
  }

  if (targetCase.archivedAt) {
    return workspaceData;
  }

  const now = new Date().toISOString();
  const nextCases = workspaceData.cases.map((entry): KingstonCase =>
    entry.id === caseId
      ? {
          ...entry,
          archivedAt: now,
          archivedBy: currentUser.name,
          updatedAt: now,
          events: [
            {
              id: createId("event"),
              kind: "comment",
              title: "Caso archivado",
              detail: "El administrador archivo el caso y lo retiro de las bandejas operativas.",
              actor: currentUser.name,
              createdAt: now
            },
            ...entry.events
          ]
        }
      : entry
  );

  return appendAuditLog(
    {
      ...workspaceData,
      cases: nextCases
    },
    currentUser,
    {
      entityType: "case",
      entityId: caseId,
      action: "case-archived",
      detail: `Se archivo ${targetCase.internalNumber}.`
    }
  );
}

function applyRestoreCase(workspaceData: WorkspaceDataState, currentUser: OwnerDirectoryEntry, caseId: string) {
  if (currentUser.team !== "ADMIN") {
    throw new WorkspaceHttpError("Solo el administrador puede restaurar casos archivados.", 403);
  }

  const targetCase = workspaceData.cases.find((entry) => entry.id === caseId);
  if (!targetCase) {
    throw new WorkspaceHttpError("No pude encontrar el caso solicitado.", 404);
  }

  if (!targetCase.archivedAt) {
    return workspaceData;
  }

  const now = new Date().toISOString();
  const nextCases = workspaceData.cases.map((entry): KingstonCase =>
    entry.id === caseId
      ? {
          ...entry,
          archivedAt: null,
          archivedBy: null,
          updatedAt: now,
          events: [
            {
              id: createId("event"),
              kind: "comment",
              title: "Caso restaurado",
              detail: "El administrador restauro el caso y volvio a dejarlo visible en las bandejas operativas.",
              actor: currentUser.name,
              createdAt: now
            },
            ...entry.events
          ]
        }
      : entry
  );

  return appendAuditLog(
    {
      ...workspaceData,
      cases: nextCases
    },
    currentUser,
    {
      entityType: "case",
      entityId: caseId,
      action: "case-restored",
      detail: `Se restauro ${targetCase.internalNumber}.`
    }
  );
}

async function createUserInDatabase(client: PoolClient, currentUser: OwnerDirectoryEntry, input: OwnerInput) {
  const email = input.email.trim().toLowerCase();
  const fullName = input.name.trim();

  if (!email || !fullName) {
    throw new WorkspaceHttpError("Nombre y email son obligatorios.", 400);
  }

  if (!input.password || input.password.trim().length < 8) {
    throw new WorkspaceHttpError("La contrasena inicial tiene que tener al menos 8 caracteres.", 400);
  }

  const existing = await getUserRowByEmail(email, client);
  if (existing) {
    throw new WorkspaceHttpError("Ya existe un usuario con ese email.", 409);
  }

  const nextUser: OwnerDirectoryEntry = {
    id: createId("user"),
    name: fullName,
    email,
    team: input.team,
    active: input.active,
    initials: buildInitials(fullName),
    permissions: normalizePermissions(input.team, input.permissions)
  };

  await client.query(
    `
      insert into kingestion_users (
        id,
        email,
        full_name,
        password_hash,
        role,
        initials,
        is_active,
        permissions_json
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
    `,
    [
      nextUser.id,
      nextUser.email,
      nextUser.name,
      hashPassword(input.password),
      nextUser.team,
      nextUser.initials,
      nextUser.active,
      JSON.stringify(nextUser.permissions)
    ]
  );

  return createAuditEntry(currentUser, {
    entityType: "user",
    entityId: nextUser.id,
    action: "user-created",
    detail: `Se agrego a ${nextUser.name} dentro de ${nextUser.team}.`
  });
}

async function updateUserInDatabase(
  client: PoolClient,
  workspaceData: WorkspaceDataState,
  currentUser: OwnerDirectoryEntry,
  userId: string,
  input: OwnerInput
) {
  const previousUser = await getUserRowById(userId, client);
  if (!previousUser) {
    throw new WorkspaceHttpError("No pude encontrar el usuario solicitado.", 404);
  }

  const email = input.email.trim().toLowerCase();
  const fullName = input.name.trim();
  const nextPermissions = normalizePermissions(input.team, input.permissions);
  const nextPasswordHash =
    input.password && input.password.trim().length > 0 ? hashPassword(input.password.trim()) : previousUser.password_hash;

  await client.query(
    `
      update kingestion_users
      set email = $2,
          full_name = $3,
          password_hash = $4,
          role = $5,
          initials = $6,
          is_active = $7,
          permissions_json = $8::jsonb,
          updated_at = now()
      where id = $1
    `,
    [userId, email, fullName, nextPasswordHash, input.team, buildInitials(fullName), input.active, JSON.stringify(nextPermissions)]
  );

  if (input.password && input.password.trim().length > 0) {
    await client.query(`delete from kingestion_sessions where user_id = $1`, [userId]);
  }

  const previousUserName = previousUser.full_name;
  const nextUserName = fullName;
  const updatedWorkspace = {
    ...workspaceData,
    cases: workspaceData.cases.map((entry) => ({
      ...entry,
      owner: entry.owner === previousUserName ? nextUserName : entry.owner,
      tasks: entry.tasks.map((task) =>
        task.assignee === previousUserName
          ? {
              ...task,
              assignee: nextUserName
            }
          : task
      )
    }))
  };

  const withAudit = appendAuditLog(updatedWorkspace, currentUser, {
    entityType: "user",
    entityId: userId,
    action: "user-updated",
    detail: `Se actualizo el usuario ${previousUserName}.`
  });

  const finalState =
    input.password && input.password.trim().length > 0
      ? appendAuditLog(withAudit, currentUser, {
          entityType: "user",
          entityId: userId,
          action: "user-password-updated",
          detail: `Se actualizo la contrasena de ${nextUserName}.`
        })
      : withAudit;

  return finalState;
}

async function deleteUserInDatabase(
  client: PoolClient,
  workspaceData: WorkspaceDataState,
  currentUser: OwnerDirectoryEntry,
  userId: string
) {
  if (currentUser.id === userId) {
    throw new WorkspaceHttpError("No podes eliminar tu propio usuario activo.", 400);
  }

  const previousUser = await getUserRowById(userId, client);
  if (!previousUser) {
    throw new WorkspaceHttpError("No pude encontrar el usuario solicitado.", 404);
  }

  await client.query(`delete from kingestion_sessions where user_id = $1`, [userId]);
  await client.query(`delete from kingestion_users where id = $1`, [userId]);

  const updatedWorkspace = {
    ...workspaceData,
    cases: workspaceData.cases.map((entry) => ({
      ...entry,
      owner: entry.owner === previousUser.full_name ? "Sin asignar" : entry.owner,
      tasks: entry.tasks.map((task) =>
        task.assignee === previousUser.full_name
          ? {
              ...task,
              assignee: "Sin asignar"
            }
          : task
      )
    }))
  };

  return appendAuditLog(updatedWorkspace, currentUser, {
    entityType: "user",
    entityId: userId,
    action: "user-deleted",
    detail: `Se elimino a ${previousUser.full_name} y las asignaciones quedaron liberadas.`
  });
}

function applyCaseViewed(workspaceData: WorkspaceDataState, currentUser: OwnerDirectoryEntry, caseId: string) {
  const entry = workspaceData.cases.find((item) => item.id === caseId);
  if (!entry) {
    return workspaceData;
  }

  return appendAuditLog(workspaceData, currentUser, {
    entityType: "case",
    entityId: caseId,
    action: "case-viewed",
    detail: `Se consulto el caso ${entry.internalNumber}.`
  });
}

function applyReportDownloaded(workspaceData: WorkspaceDataState, currentUser: OwnerDirectoryEntry, reportName: string) {
  return appendAuditLog(workspaceData, currentUser, {
    entityType: "report",
    entityId: reportName,
    action: "report-downloaded",
    detail: `Se descargo el reporte ${reportName}.`
  });
}

export type WorkspaceMutation =
  | { type: "createCase"; input: CreateCaseInput }
  | { type: "addCaseAttachment"; caseId: string; input: CaseAttachmentInput }
  | { type: "removeCaseAttachment"; caseId: string; attachmentId: string }
  | { type: "updateReplacementSku"; caseId: string; replacementSku: string }
  | { type: "markReimbursementInProcess"; caseId: string }
  | { type: "completeReimbursement"; caseId: string }
  | { type: "requestReimbursementMissingData"; caseId: string }
  | { type: "createUser"; input: OwnerInput }
  | { type: "updateUser"; userId: string; input: OwnerInput }
  | { type: "deleteUser"; userId: string }
  | { type: "assignCaseOwner"; caseId: string; ownerName: string }
  | { type: "updateCaseStatus"; caseId: string; status: KingstonCase["externalStatus"] }
  | {
      type: "completeQueueStep";
      caseId: string;
      nextStatus?: KingstonCase["externalStatus"];
      guideNumber?: string;
    }
  | { type: "archiveCase"; caseId: string }
  | { type: "restoreCase"; caseId: string }
  | { type: "deleteCase"; caseId: string }
  | { type: "recordCaseView"; caseId: string }
  | { type: "recordReportDownload"; reportName: string }
  | { type: "importLegacyState"; state: WorkspaceDataState };

export type WorkspaceMutationResult = {
  snapshot: WorkspaceSnapshot;
  createdCaseId?: string;
};

export async function applyWorkspaceMutation(
  currentUserId: string,
  mutation: WorkspaceMutation
): Promise<WorkspaceMutationResult> {
  await ensureKingestionSchema();
  const client = await connectDatabaseClient();

  try {
    await client.query("begin");
    const owners = await loadUsers(client);
    const currentUser = owners.find((owner) => owner.id === currentUserId && owner.active);

    if (!currentUser) {
      throw new WorkspaceHttpError("La sesion actual no tiene un usuario activo.", 401);
    }

    let workspaceData = await loadWorkspaceData(client);
    let createdCaseId: string | undefined;

    switch (mutation.type) {
      case "createCase":
        assertModuleManage(currentUser, "open-cases");
        {
          const result = applyCreateCase(workspaceData, currentUser, mutation.input);
          workspaceData = result.workspaceData;
          createdCaseId = result.createdCaseId;
          await bindKingestionAttachmentBlobsToCase({
            caseId: createdCaseId,
            attachments: mutation.input.attachments,
            client
          });
        }
        break;
      case "addCaseAttachment":
        assertModuleManage(currentUser, "open-cases");
        workspaceData = applyAddCaseAttachment(workspaceData, currentUser, mutation.caseId, mutation.input);
        await bindKingestionAttachmentBlobsToCase({
          caseId: mutation.caseId,
          attachments: [mutation.input],
          client
        });
        break;
      case "removeCaseAttachment":
        assertModuleManage(currentUser, "open-cases");
        workspaceData = applyRemoveCaseAttachment(workspaceData, currentUser, mutation.caseId, mutation.attachmentId);
        break;
      case "updateReplacementSku":
        assertModuleManage(currentUser, "open-cases");
        workspaceData = applyUpdateReplacementSku(workspaceData, currentUser, mutation.caseId, mutation.replacementSku);
        break;
      case "markReimbursementInProcess":
        assertModuleAccess(currentUser, "reimbursements");
        workspaceData = applyMarkReimbursementInProcess(workspaceData, currentUser, mutation.caseId);
        break;
      case "completeReimbursement":
        assertModuleAccess(currentUser, "reimbursements");
        workspaceData = applyCompleteReimbursement(workspaceData, currentUser, mutation.caseId);
        break;
      case "requestReimbursementMissingData":
        assertModuleAccess(currentUser, "reimbursements");
        workspaceData = applyRequestReimbursementMissingData(workspaceData, currentUser, mutation.caseId);
        break;
      case "createUser": {
        assertModuleManage(currentUser, "settings");
        const audit = await createUserInDatabase(client, currentUser, mutation.input);
        workspaceData = {
          ...workspaceData,
          auditLog: [audit, ...workspaceData.auditLog].slice(0, 500)
        };
        break;
      }
      case "updateUser":
        assertModuleManage(currentUser, "settings");
        workspaceData = await updateUserInDatabase(client, workspaceData, currentUser, mutation.userId, mutation.input);
        break;
      case "deleteUser":
        assertModuleManage(currentUser, "settings");
        workspaceData = await deleteUserInDatabase(client, workspaceData, currentUser, mutation.userId);
        break;
      case "assignCaseOwner":
        assertModuleManage(currentUser, "open-cases");
        workspaceData = applyAutomaticCaseOwner(
          workspaceData,
          currentUser,
          mutation.caseId,
          owners,
          "Recalculo solicitado desde asignacion de responsable."
        );
        break;
      case "updateCaseStatus":
        assertModuleManage(currentUser, "open-cases");
        workspaceData = applyUpdateCaseStatus(workspaceData, currentUser, mutation.caseId, mutation.status);
        break;
      case "completeQueueStep":
        workspaceData = applyCompleteQueueStep(workspaceData, currentUser, mutation.caseId, {
          nextStatus: mutation.nextStatus,
          guideNumber: mutation.guideNumber
        });
        break;
      case "archiveCase":
        workspaceData = applyArchiveCase(workspaceData, currentUser, mutation.caseId);
        break;
      case "restoreCase":
        workspaceData = applyRestoreCase(workspaceData, currentUser, mutation.caseId);
        break;
      case "deleteCase":
        workspaceData = applyDeleteCase(workspaceData, currentUser, mutation.caseId);
        break;
      case "recordCaseView":
        workspaceData = applyCaseViewed(workspaceData, currentUser, mutation.caseId);
        break;
      case "recordReportDownload":
        workspaceData = applyReportDownloaded(workspaceData, currentUser, mutation.reportName);
        break;
      case "importLegacyState":
        if (currentUser.team !== "ADMIN") {
          throw new WorkspaceHttpError("Solo el administrador puede importar estado legado.", 403);
        }
        workspaceData = normalizeWorkspaceData(mutation.state);
        workspaceData = appendAuditLog(workspaceData, currentUser, {
          entityType: "session",
          entityId: "legacy-import",
          action: "session-login",
          detail: "Se importo el estado legado del navegador."
        });
        break;
      default:
        throw new WorkspaceHttpError("La accion solicitada no existe.", 400);
    }

    const assignmentOwners =
      mutation.type === "createUser" || mutation.type === "updateUser" || mutation.type === "deleteUser"
        ? await loadUsers(client)
        : owners;
    workspaceData = applyAutomaticCaseOwners(
      workspaceData,
      currentUser,
      assignmentOwners,
      "Revision automatica posterior a la accion solicitada."
    );

    await saveWorkspaceData(workspaceData, client);
    await client.query("commit");

    const refreshedOwners = await loadUsers();
    const refreshedCurrentUser = refreshedOwners.find((owner) => owner.id === currentUserId && owner.active);

    if (!refreshedCurrentUser) {
      throw new WorkspaceHttpError("No pude refrescar el usuario actual.", 401);
    }

    return {
      createdCaseId,
      snapshot: buildWorkspaceSnapshotForUser(workspaceData, refreshedOwners, refreshedCurrentUser)
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function listAutomationCases(filters: AutomationCaseFilters = {}) {
  await ensureKingestionSchema();
  const workspaceData = await loadWorkspaceData();

  return workspaceData.cases
    .filter((entry) => matchesAutomationCaseFilters(entry, filters))
    .toSorted((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

export async function getAutomationCase(caseId: string) {
  await ensureKingestionSchema();
  const workspaceData = await loadWorkspaceData();

  return workspaceData.cases.find((entry) => entry.id === caseId) ?? null;
}

export async function getAutomationActivity(filters: AutomationActivityFilters = {}) {
  await ensureKingestionSchema();
  const workspaceData = await loadWorkspaceData();
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  const sinceTimestamp = filters.since ? new Date(filters.since).getTime() : null;

  return workspaceData.auditLog
    .filter((entry) => {
      if (filters.action && entry.action !== filters.action) {
        return false;
      }

      if (filters.entityType && entry.entityType !== filters.entityType) {
        return false;
      }

      if (sinceTimestamp && new Date(entry.createdAt).getTime() < sinceTimestamp) {
        return false;
      }

      return true;
    })
    .slice(0, limit);
}

export async function getKingestionAutomationControlState(client?: PoolClient) {
  const setting = await getSystemSetting(AUTOMATION_CONTROL_NAMESPACE, AUTOMATION_CONTROL_KEY, client);
  return normalizeAutomationControlState(setting?.value_json);
}

export async function getKingestionAutomationCloudStatus(): Promise<AutomationCloudStatus> {
  await ensureKingestionSchema();
  const [control, workspaceData, nativeStateSetting] = await Promise.all([
    getKingestionAutomationControlState(),
    loadWorkspaceData(),
    getSystemSetting(AUTOMATION_CONTROL_NAMESPACE, AUTOMATION_NATIVE_STATE_KEY)
  ]);
  const nativeState =
    nativeStateSetting?.value_json && typeof nativeStateSetting.value_json === "object"
      ? (nativeStateSetting.value_json as {
          lastRunAt?: string | null;
          processedMailKeys?: unknown[];
        })
      : null;
  const lastCaseActivityAt = workspaceData.cases.reduce<string | null>((latest, entry) => {
    if (!latest) {
      return entry.updatedAt;
    }

    return new Date(entry.updatedAt).getTime() > new Date(latest).getTime() ? entry.updatedAt : latest;
  }, null);
  const lastAutomationAuditAt =
    workspaceData.auditLog.find(
      (entry) =>
        entry.actorName === "Automatizacion Kingestion" ||
        entry.actorName === "Automatizacion n8n" ||
        entry.action === "automation-control-paused" ||
        entry.action === "automation-control-resumed" ||
        entry.action === "automation-triggered" ||
        entry.action === "automation-native-run" ||
        entry.action === "automation-mail-processed" ||
        entry.action === "automation-status-email-sent"
    )?.createdAt ?? null;

  return {
    control,
    cloudOnly: true,
    pilotMode: process.env.KINGESTION_AUTOMATION_PILOT_MODE !== "false",
    manualTriggerConfigured: Boolean(
      process.env.KINGESTION_MAIL_USER?.trim() && process.env.KINGESTION_MAIL_PASSWORD?.trim()
    ),
    proofAttachmentAiEnabled: process.env.KINGESTION_AUTOMATION_PROOF_AI !== "false",
    statusNotificationsEnabled: true,
    ingestionCadence: "hourly",
    targetPlatform: "Kingestion",
    lastCaseActivityAt,
    lastAutomationAuditAt,
    lastRunAt: typeof nativeState?.lastRunAt === "string" ? nativeState.lastRunAt : null,
    processedMailCount: Array.isArray(nativeState?.processedMailKeys) ? nativeState.processedMailKeys.length : 0
  };
}

export async function setKingestionAutomationPaused(args: {
  paused: boolean;
  actor: OwnerDirectoryEntry;
}) {
  await ensureKingestionSchema();
  const client = await connectDatabaseClient();

  try {
    await client.query("begin");
    let workspaceData = await loadWorkspaceData(client);
    const nextState = args.paused
      ? {
          paused: true,
          pausedAt: new Date().toISOString(),
          pausedByUserId: args.actor.id,
          pausedByUserName: args.actor.name
        }
      : buildDefaultAutomationControlState();

    await upsertSystemSetting({
      namespace: AUTOMATION_CONTROL_NAMESPACE,
      key: AUTOMATION_CONTROL_KEY,
      value: nextState,
      description: "Control manual para pausar o reanudar la automatizacion nativa Kingston.",
      client
    });

    workspaceData = appendAuditLog(workspaceData, args.actor, {
      entityType: "session",
      entityId: `${AUTOMATION_CONTROL_NAMESPACE}:${AUTOMATION_CONTROL_KEY}`,
      action: args.paused ? "automation-control-paused" : "automation-control-resumed",
      detail: args.paused
        ? "Se pauso manualmente la automatizacion nativa de correos Kingston."
        : "Se reanudo manualmente la automatizacion nativa de correos Kingston."
    });

    await saveWorkspaceData(workspaceData, client);
    await client.query("commit");

    return nextState;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function triggerKingestionAutomationRun(args: {
  actor: OwnerDirectoryEntry;
}): Promise<AutomationTriggerResult> {
  await ensureKingestionSchema();
  const control = await getKingestionAutomationControlState();
  const triggeredAt = new Date().toISOString();
  const mode = process.env.KINGESTION_AUTOMATION_PILOT_MODE === "false" ? "production" : "pilot";

  if (control.paused) {
    return {
      ok: true,
      queued: false,
      paused: true,
      triggeredAt,
      mode,
      target: "Kingestion",
      message: "La automatizacion nativa esta pausada manualmente en Kingestion."
    };
  }

  const client = await connectDatabaseClient();

  try {
    await client.query("begin");
    let workspaceData = await loadWorkspaceData(client);
    workspaceData = appendAuditLog(workspaceData, args.actor, {
      entityType: "session",
      entityId: "kingestion-native-automation-trigger",
      action: "automation-triggered",
      detail: `El disparador legado fue llamado en modo ${mode}; el flujo activo corre con la automatizacion nativa.`
    });
    await saveWorkspaceData(workspaceData, client);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return {
    ok: true,
    queued: false,
    paused: false,
    triggeredAt,
    mode,
    target: "Kingestion",
    message: "El disparador legado ya no usa n8n. Ejecuta /api/automation/trigger/kingston-rma para correr el motor nativo."
  };
}

export async function createAutomationCase(input: CreateCaseInput) {
  await ensureKingestionSchema();
  const client = await connectDatabaseClient();
  const automationActor = createAutomationActor();

  try {
    await client.query("begin");
    const owners = await loadUsers(client);
    const workspaceData = await loadWorkspaceData(client);
    const result = applyCreateCase(workspaceData, automationActor, input);
    const nextWorkspaceData = applyAutomaticCaseOwners(
      result.workspaceData,
      automationActor,
      owners,
      "Revision automatica posterior al alta por automatizacion."
    );
    await bindKingestionAttachmentBlobsToCase({
      caseId: result.createdCaseId,
      attachments: input.attachments,
      client
    });
    await saveWorkspaceData(nextWorkspaceData, client);
    await client.query("commit");

    return nextWorkspaceData.cases.find((entry) => entry.id === result.createdCaseId) ?? null;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function patchAutomationCase(caseId: string, patch: AutomationCasePatch) {
  await ensureKingestionSchema();
  const client = await connectDatabaseClient();
  const automationActor = createAutomationActor();

  try {
    await client.query("begin");
    const owners = await loadUsers(client);
    let workspaceData = await loadWorkspaceData(client);

    if (patch.procurement) {
      workspaceData = applyUpdateCaseProcurement(workspaceData, automationActor, caseId, patch.procurement);
    }

    if (patch.logistics) {
      workspaceData = applyUpdateCaseLogistics(workspaceData, automationActor, caseId, patch.logistics);
    }

    if (patch.owner && patch.owner.trim().length > 0) {
      workspaceData = applyAutomaticCaseOwner(
        workspaceData,
        automationActor,
        caseId,
        owners,
        "Recalculo solicitado por automatizacion."
      );
    }

    if (patch.replacementSku !== undefined) {
      workspaceData = applyUpdateReplacementSku(workspaceData, automationActor, caseId, patch.replacementSku ?? "");
    }

    if (patch.attachment) {
      workspaceData = applyAddCaseAttachment(workspaceData, automationActor, caseId, patch.attachment);
      await bindKingestionAttachmentBlobsToCase({
        caseId,
        attachments: [patch.attachment],
        client
      });
    }

    if (patch.comment) {
      workspaceData = applyAddCaseComment(workspaceData, automationActor, caseId, patch.comment);
    }

    if (patch.completeReimbursement) {
      workspaceData = applyCompleteReimbursement(workspaceData, automationActor, caseId);
    }

    if (patch.completeQueueStep) {
      workspaceData = applyCompleteQueueStep(workspaceData, automationActor, caseId);
    }

    if (patch.status) {
      workspaceData = applyUpdateCaseStatus(workspaceData, automationActor, caseId, patch.status);
    }

    if (patch.archive) {
      workspaceData = applyArchiveCase(workspaceData, automationActor, caseId);
    }

    if (patch.restore) {
      workspaceData = applyRestoreCase(workspaceData, automationActor, caseId);
    }

    workspaceData = applyAutomaticCaseOwners(
      workspaceData,
      automationActor,
      owners,
      "Revision automatica posterior a una actualizacion por automatizacion."
    );

    await saveWorkspaceData(workspaceData, client);
    await client.query("commit");

    return workspaceData.cases.find((entry) => entry.id === caseId) ?? null;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function buildRemoteControlSummary(workspaceData: WorkspaceDataState, owners: OwnerDirectoryEntry[]) {
  const openCases = getOpenCases(workspaceData.cases);
  const closedCases = getClosedCases(workspaceData.cases);
  const archivedCases = getArchivedCases(workspaceData.cases);
  const pendingReimbursements = workspaceData.cases.filter(
    (entry) => shouldTrackReimbursement(entry) && entry.logistics.reimbursementState !== "Completed" && !entry.archivedAt
  );
  const pendingPurchases = workspaceData.cases.filter(
    (entry) =>
      !entry.archivedAt &&
      (entry.externalStatus === "Liberar mercaderia" ||
        entry.externalStatus === "OV creada" ||
        entry.externalStatus === "Pedido Kingston")
  );
  const pendingService = workspaceData.cases.filter(
    (entry) =>
      !entry.archivedAt &&
      (entry.externalStatus === "Informado" || entry.externalStatus === "Pedido deposito y etiquetado")
  );

  return {
    openCases: openCases.length,
    closedCases: closedCases.length,
    archivedCases: archivedCases.length,
    pendingReimbursements: pendingReimbursements.length,
    pendingPurchases: pendingPurchases.length,
    pendingService: pendingService.length,
    activeUsers: owners.filter((owner) => owner.active).length,
    serverTime: new Date().toISOString()
  };
}

export async function runRemoteControlAction(
  actor: OwnerDirectoryEntry,
  options?: {
    action?: RemoteControlAction;
    source?: RemoteControlSource;
  }
): Promise<RemoteControlResult> {
  await ensureKingestionSchema();
  const client = await connectDatabaseClient();
  const action = options?.action ?? "diagnostico";
  const source = options?.source ?? "api";

  try {
    await client.query("begin");
    let workspaceData = await loadWorkspaceData(client);
    const owners = await loadUsers(client);
    const summary = buildRemoteControlSummary(workspaceData, owners);
    const executedAt = new Date().toISOString();
    const runId = createId("remote");
    const message =
      action === "diagnostico"
        ? `Diagnostico remoto ejecutado. Abiertos: ${summary.openCases}, cerrados: ${summary.closedCases}, archivados: ${summary.archivedCases}.`
        : "Accion remota ejecutada.";

    workspaceData = appendAuditLog(workspaceData, actor, {
      entityType: "session",
      entityId: runId,
      action: "remote-control-run",
      detail: `${message} Origen: ${source}.`
    });

    await saveWorkspaceData(workspaceData, client);
    await client.query("commit");

    return {
      runId,
      action,
      source,
      actorName: actor.name,
      executedAt,
      message,
      summary
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
