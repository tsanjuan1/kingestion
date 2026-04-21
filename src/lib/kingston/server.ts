import "server-only";

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Pool, PoolClient } from "pg";

import {
  archivedCasesSeed,
  getDefaultPermissionsForRole,
  kingstonCases,
  modulePermissionKeys
} from "@/lib/kingston/data";
import type { CaseAttachmentInput, CreateCaseInput, OwnerInput, WorkspaceSnapshot } from "@/lib/kingston/contracts";
import {
  buildCaseAddress,
  canAccessModule,
  canManageModule,
  getInitialSubstatus,
  getNextActionCopy,
  hasReachedReimbursementTrigger,
  isReimbursementZone,
  normalizeStatus,
  shouldTrackReimbursement
} from "@/lib/kingston/helpers";
import type {
  CaseAttachment,
  CaseEvent,
  ClientBankingDetails,
  KingstonCase,
  ModulePermissionKey,
  ModulePermissions,
  OwnerDirectoryEntry,
  UserInteractionLog,
  WorkspaceDataState
} from "@/lib/kingston/types";

const WORKSPACE_ROW_KEY = "default";
const SESSION_COOKIE_NAME = "kingestion_session";
const SESSION_DURATION_DAYS = 14;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

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
      entry.logistics.reimbursementState === "Completed");
  const normalizedReimbursementState =
    entry.logistics.reimbursementState === "Completed"
      ? "Completed"
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

function normalizeWorkspaceData(rawState: WorkspaceDataState | null | undefined): WorkspaceDataState {
  const fallback = getDefaultWorkspaceData();

  return {
    cases: Array.isArray(rawState?.cases) && rawState.cases.length > 0 ? rawState.cases.map(normalizeCase) : fallback.cases,
    auditLog: Array.isArray(rawState?.auditLog) ? rawState.auditLog : fallback.auditLog
  };
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

      await pool.query(`
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
      `);

      const initialState = getDefaultWorkspaceData();

      await pool.query(
        `
          insert into kingestion_workspace_state (key, data_json, updated_at)
          values ($1, $2::jsonb, now())
          on conflict (key) do nothing
        `,
        [WORKSPACE_ROW_KEY, JSON.stringify(initialState)]
      );
    })();
  }

  return schemaReadyPromise;
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

async function loadWorkspaceData(client?: PoolClient) {
  await ensureKingestionSchema();
  const runner = client ?? pool;
  const result = await runner.query<{ data_json: WorkspaceDataState }>(
    `
      select data_json
      from kingestion_workspace_state
      where key = $1
    `,
    [WORKSPACE_ROW_KEY]
  );

  return normalizeWorkspaceData(result.rows[0]?.data_json);
}

async function saveWorkspaceData(state: WorkspaceDataState, client?: PoolClient) {
  const runner = client ?? pool;
  await runner.query(
    `
      update kingestion_workspace_state
      set data_json = $2::jsonb,
          updated_at = now()
      where key = $1
    `,
    [WORKSPACE_ROW_KEY, JSON.stringify(state)]
  );
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
  const [owners, workspaceData] = await Promise.all([loadUsers(), loadWorkspaceData()]);
  const currentUser = owners.find((owner) => owner.id === currentUserId && owner.active);

  if (!currentUser) {
    throw new WorkspaceHttpError("La sesion actual no tiene un usuario activo.", 401);
  }

  return {
    ...workspaceData,
    owners,
    currentUser
  };
}

export async function getAuthSessionUser() {
  await ensureKingestionSchema();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const result = await pool.query<UserRow>(
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
    await clearSessionCookie();
    return null;
  }

  if (!userRow.is_active) {
    await clearSessionCookie();
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

  await pool.query(
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
    await pool.query(`delete from kingestion_sessions where token_hash = $1`, [hashSessionToken(token)]);
  }

  await clearSessionCookie();
}

export async function bootstrapAdminUser(input: { name: string; email: string; password: string }) {
  await ensureKingestionSchema();

  const existingUsers = await pool.query<{ total: string }>(`select count(*)::text as total from kingestion_users`);
  if (Number(existingUsers.rows[0]?.total ?? 0) > 0) {
    throw new WorkspaceHttpError("La plataforma ya tiene usuarios creados.", 409);
  }

  const userId = createId("user");
  await pool.query(
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

export async function hasBootstrapUser() {
  await ensureKingestionSchema();
  const result = await pool.query<{ total: string }>(`select count(*)::text as total from kingestion_users`);
  return Number(result.rows[0]?.total ?? 0) > 0;
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
    previewUrl: attachment.previewUrl
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
      previewUrl: input.previewUrl
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
            : isReimbursementZone(entry.zone) &&
                (hasReachedReimbursementTrigger(status, entry.zone) ||
                  entry.logistics.reimbursementState === "Pending" ||
                  entry.logistics.reimbursementState === "Requested")
              ? entry.attachments.some((attachment) => attachment.kind === "proof" || attachment.kind === "photo")
                ? "Requested"
                : "Pending"
              : "Not applicable",
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
  | { type: "completeReimbursement"; caseId: string }
  | { type: "createUser"; input: OwnerInput }
  | { type: "updateUser"; userId: string; input: OwnerInput }
  | { type: "deleteUser"; userId: string }
  | { type: "assignCaseOwner"; caseId: string; ownerName: string }
  | { type: "updateCaseStatus"; caseId: string; status: KingstonCase["externalStatus"] }
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
  const client = await pool.connect();

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
        }
        break;
      case "addCaseAttachment":
        assertModuleManage(currentUser, "open-cases");
        workspaceData = applyAddCaseAttachment(workspaceData, currentUser, mutation.caseId, mutation.input);
        break;
      case "removeCaseAttachment":
        assertModuleManage(currentUser, "open-cases");
        workspaceData = applyRemoveCaseAttachment(workspaceData, currentUser, mutation.caseId, mutation.attachmentId);
        break;
      case "updateReplacementSku":
        assertModuleManage(currentUser, "open-cases");
        workspaceData = applyUpdateReplacementSku(workspaceData, currentUser, mutation.caseId, mutation.replacementSku);
        break;
      case "completeReimbursement":
        assertModuleAccess(currentUser, "reimbursements");
        workspaceData = applyCompleteReimbursement(workspaceData, currentUser, mutation.caseId);
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
        workspaceData = applyAssignCaseOwner(workspaceData, currentUser, mutation.caseId, mutation.ownerName);
        break;
      case "updateCaseStatus":
        assertModuleManage(currentUser, "open-cases");
        workspaceData = applyUpdateCaseStatus(workspaceData, currentUser, mutation.caseId, mutation.status);
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

    await saveWorkspaceData(workspaceData, client);
    await client.query("commit");

    const refreshedOwners = await loadUsers();
    const refreshedCurrentUser = refreshedOwners.find((owner) => owner.id === currentUserId && owner.active);

    if (!refreshedCurrentUser) {
      throw new WorkspaceHttpError("No pude refrescar el usuario actual.", 401);
    }

    return {
      createdCaseId,
      snapshot: {
        ...workspaceData,
        owners: refreshedOwners,
        currentUser: refreshedCurrentUser
      }
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
