"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { kingstonCases, ownerDirectory, workflowStates } from "@/lib/kingston/data";
import {
  buildCaseAddress,
  getClosedCases,
  getDashboardSnapshot,
  getInitialSubstatus,
  getNextActionCopy,
  getOpenCases,
  getReportsSnapshot
} from "@/lib/kingston/helpers";
import type {
  CaseAttachment,
  CasePriority,
  CaseEvent,
  ClientBankingDetails,
  DeliveryMode,
  ExternalStatus,
  KingstonCase,
  OwnerDirectoryEntry,
  UserInteractionLog,
  Zone
} from "@/lib/kingston/types";

const STORAGE_KEY = "kingestion.workspace.v3";
export type ThemeMode = "light" | "dark";

type WorkspaceState = {
  cases: KingstonCase[];
  owners: OwnerDirectoryEntry[];
  auditLog: UserInteractionLog[];
  activeOwnerId: string | null;
  themeMode: ThemeMode;
};

type OwnerInput = {
  name: string;
  email: string;
  team: OwnerDirectoryEntry["team"];
  active: boolean;
};

type CreateCaseInput = {
  kingstonNumber: string;
  clientName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  owner: string;
  externalStatus: ExternalStatus;
  zone: Zone;
  deliveryMode: DeliveryMode;
  priority: CasePriority;
  address: string;
  province: string;
  city: string;
  sku: string;
  replacementSku?: string;
  quantity: number;
  productDescription: string;
  failureDescription: string;
  nextAction: string;
  observations: string;
  origin: KingstonCase["origin"];
  banking?: Partial<ClientBankingDetails>;
  attachments?: CaseAttachmentInput[];
};

type CaseAttachmentInput = {
  name: string;
  kind?: CaseAttachment["kind"];
  sizeLabel: string;
  mimeType?: string;
  previewUrl?: string;
};

type KingestionContextValue = WorkspaceState & {
  activeOwner: OwnerDirectoryEntry | null;
  openCases: KingstonCase[];
  closedCases: KingstonCase[];
  activeOwners: OwnerDirectoryEntry[];
  canManageReimbursements: boolean;
  dashboardSnapshot: ReturnType<typeof getDashboardSnapshot>;
  reportsSnapshot: ReturnType<typeof getReportsSnapshot>;
  findCaseById: (caseId: string) => KingstonCase | undefined;
  setActiveOwner: (ownerId: string) => void;
  setThemeMode: (themeMode: ThemeMode) => void;
  createCase: (input: CreateCaseInput) => string;
  addCaseAttachment: (caseId: string, input: CaseAttachmentInput) => boolean;
  removeCaseAttachment: (caseId: string, attachmentId: string) => boolean;
  updateReplacementSku: (caseId: string, replacementSku: string) => boolean;
  completeReimbursement: (caseId: string) => boolean;
  createOwner: (input: OwnerInput) => void;
  updateOwner: (ownerId: string, input: OwnerInput) => void;
  deleteOwner: (ownerId: string) => void;
  assignCaseOwner: (caseId: string, ownerName: string) => void;
  updateCaseStatus: (caseId: string, status: ExternalStatus) => void;
  recordCaseView: (caseId: string) => void;
  recordReportDownload: (reportName: string) => void;
};

type ClientDetails = {
  fullAddress: string;
  banking: ClientBankingDetails;
};

const clientDirectory: Record<string, ClientDetails> = {
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

const archivedCasesSeed: KingstonCase[] = [
  {
    id: "rma-23984",
    internalNumber: "RMA-23984",
    kingstonNumber: "KS-982771",
    clientName: "Data Vision Patagonia",
    contactName: "Mauro Ilardo",
    contactEmail: "m.ilardo@datavision.com.ar",
    contactPhone: "+54 299 481 9033",
    zone: "Interior / Gran Buenos Aires",
    deliveryMode: "Dispatch",
    priority: "Medium",
    owner: "Martin Ponce",
    nextAction: "Caso fuera de la bandeja operativa. No requiere una proxima accion abierta.",
    externalStatus: "Realizado",
    internalSubstatus: "Cambio exitoso",
    openedAt: "2026-03-26T10:40:00-03:00",
    updatedAt: "2026-04-09T17:10:00-03:00",
    slaDueAt: "2026-04-10T18:00:00-03:00",
    address: "Belgrano 455",
    province: "Neuquen",
    city: "Neuquen Capital",
    sku: "KC3000/2048G",
    productDescription: "SSD KC3000 2TB NVMe",
    quantity: 2,
    failureDescription: "Lote con perdida total de deteccion luego de reinicios en caliente.",
    origin: "Kingston email",
    observations: "Reemplazo entregado y recepcion confirmado por el cliente.",
    logistics: {
      mode: "Dispatch",
      address: "Belgrano 455, Neuquen Capital, Neuquen, Argentina",
      transporter: "Andreani",
      guideNumber: "A99823145",
      trackingUrl: "https://tracking.andreani.example/A99823145",
      dispatchDate: "2026-04-08T14:15:00-03:00",
      deliveredDate: "2026-04-09T11:20:00-03:00",
      shippingCost: "ARS 24.900",
      reimbursementState: "Completed"
    },
    procurement: {
      localStock: "Available",
      wholesalerStock: "Pending",
      wholesalerName: null,
      requiresKingstonOrder: false,
      kingstonRequestedAt: null,
      receivedFromUsaAt: null,
      releasedByPurchasing: true,
      releasedAt: "2026-04-07T09:00:00-03:00",
      movedToRmaWarehouse: true,
      movedToRmaWarehouseAt: "2026-04-07T12:30:00-03:00"
    },
    tasks: [
      {
        id: "task-23984-1",
        title: "Confirmar recepcion final",
        description: "Validar entrega y cerrar el caso.",
        type: "logistics",
        assignee: "Martin Ponce",
        priority: "Medium",
        dueAt: "2026-04-09T16:00:00-03:00",
        state: "Completed"
      }
    ],
    comments: [
      {
        id: "comment-23984-1",
        author: "Martin Ponce",
        body: "Cliente confirmo recepcion y funcionamiento correcto del reemplazo.",
        internal: true,
        createdAt: "2026-04-09T17:10:00-03:00"
      }
    ],
    attachments: [
      {
        id: "attachment-23984-1",
        name: "constancia-recepcion.pdf",
        kind: "proof",
        sizeLabel: "328 KB",
        uploadedBy: "Martin Ponce",
        createdAt: "2026-04-09T17:08:00-03:00"
      }
    ],
    events: [
      {
        id: "event-23984-1",
        kind: "logistics",
        title: "Entrega confirmada",
        detail: "Andreani informo entrega y el cliente confirmo recepcion del reemplazo.",
        actor: "Martin Ponce",
        createdAt: "2026-04-09T17:10:00-03:00"
      }
    ]
  },
  {
    id: "rma-23980",
    internalNumber: "RMA-23980",
    kingstonNumber: "KS-982401",
    clientName: "Zeta Servicios Informaticos",
    contactName: "Carla Biondi",
    contactEmail: "cbiondi@zetasi.com.ar",
    contactPhone: "+54 11 4331 8820",
    zone: "Capital / AMBA",
    deliveryMode: "Pickup",
    priority: "Low",
    owner: "Sofia Mendez",
    nextAction: "Caso fuera de la bandeja operativa. No requiere una proxima accion abierta.",
    externalStatus: "Cerrado",
    internalSubstatus: "Caso cancelado administrativamente",
    openedAt: "2026-03-21T13:15:00-03:00",
    updatedAt: "2026-03-25T16:40:00-03:00",
    slaDueAt: "2026-03-29T18:00:00-03:00",
    address: "Av. Santa Fe 3250",
    province: "Buenos Aires",
    city: "CABA",
    sku: "DTMAXA/256GB",
    productDescription: "Pendrive DataTraveler Max 256GB",
    quantity: 4,
    failureDescription: "El cliente informo fallas, pero luego solicito cerrar el proceso por reposicion propia.",
    origin: "Operations load",
    observations: "Kingston y ANYX acordaron cierre administrativo sin reemplazo.",
    logistics: {
      mode: "Pickup",
      address: "Mostrador central ANYX",
      transporter: null,
      guideNumber: null,
      trackingUrl: null,
      dispatchDate: null,
      deliveredDate: null,
      shippingCost: null,
      reimbursementState: "Not applicable"
    },
    procurement: {
      localStock: "Pending",
      wholesalerStock: "Pending",
      wholesalerName: null,
      requiresKingstonOrder: false,
      kingstonRequestedAt: null,
      receivedFromUsaAt: null,
      releasedByPurchasing: false,
      releasedAt: null,
      movedToRmaWarehouse: false,
      movedToRmaWarehouseAt: null
    },
    tasks: [],
    comments: [
      {
        id: "comment-23980-1",
        author: "Sofia Mendez",
        body: "Se cierra por definicion comercial y conformidad del cliente.",
        internal: true,
        createdAt: "2026-03-25T16:40:00-03:00"
      }
    ],
    attachments: [],
    events: [
      {
        id: "event-23980-1",
        kind: "status-change",
        title: "Cierre administrativo",
        detail: "El cliente solicito cerrar el caso sin reemplazo fisico.",
        actor: "Sofia Mendez",
        createdAt: "2026-03-25T16:40:00-03:00"
      }
    ]
  }
];

const KingestionContext = createContext<KingestionContextValue | null>(null);

function normalizeStatus(status: string): ExternalStatus {
  if (status === "Vencido") {
    return "Cerrado";
  }

  return status as ExternalStatus;
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "NA";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
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

function addDays(baseDate: Date, days: number) {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString();
}

function getSlaDays(priority: CasePriority) {
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

function getInitialTaskDueDays(priority: CasePriority) {
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

function canManageReimbursementForOwner(owner: OwnerDirectoryEntry | null) {
  return owner?.team === "Management" || owner?.team === "Purchasing";
}

function normalizeOwner(owner: OwnerDirectoryEntry): OwnerDirectoryEntry {
  return {
    ...owner,
    initials: owner.initials || buildInitials(owner.name),
    active: owner.active ?? true
  };
}

function normalizeCase(entry: KingstonCase): KingstonCase {
  const normalizedStatus = normalizeStatus(entry.externalStatus);
  const hadLegacyExpiredStatus = (entry as { externalStatus: string }).externalStatus === "Vencido";
  const clientDetails = clientDirectory[entry.clientName];
  const baseAddress = clientDetails?.fullAddress ?? buildCaseAddress(entry);
  const logisticsAddress =
    entry.deliveryMode === "Pickup" ? entry.logistics.address : clientDetails?.fullAddress ?? entry.logistics.address;
  const statusOrder = workflowStates.find((item) => item.status === normalizedStatus)?.order ?? 0;
  const hasProofAttachment = entry.attachments.some(
    (attachment) => attachment.kind === "proof" || attachment.kind === "photo"
  );
  const isEligibleForReimbursementFlow =
    entry.deliveryMode === "Dispatch" &&
    entry.zone === "Interior / Gran Buenos Aires" &&
    statusOrder >= 3;
  const normalizedReimbursementState =
    entry.deliveryMode === "Pickup"
      ? "Not applicable"
      : entry.logistics.reimbursementState === "Completed"
        ? "Completed"
        : entry.logistics.reimbursementState === "Requested"
          ? isEligibleForReimbursementFlow ? "Requested" : "Not applicable"
          : entry.logistics.reimbursementState === "Pending"
            ? isEligibleForReimbursementFlow ? "Pending" : "Not applicable"
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
    internalSubstatus:
      entry.internalSubstatus && !hadLegacyExpiredStatus
        ? entry.internalSubstatus
        : getInitialSubstatus(normalizedStatus),
    logistics: {
      ...entry.logistics,
      address: logisticsAddress,
      reimbursementState: normalizedReimbursementState
    }
  };
}

function createDefaultState(): WorkspaceState {
  const owners = ownerDirectory.map(normalizeOwner);
  const cases = [...kingstonCases, ...archivedCasesSeed].map(normalizeCase);
  const activeOwnerId = owners.find((owner) => owner.active)?.id ?? null;

  return {
    cases,
    owners,
    auditLog: [],
    activeOwnerId,
    themeMode: "light"
  };
}

function restoreState(rawState: string): WorkspaceState {
  const parsed = JSON.parse(rawState) as Partial<WorkspaceState>;
  const fallback = createDefaultState();
  const owners = Array.isArray(parsed.owners) && parsed.owners.length > 0
    ? parsed.owners.map(normalizeOwner)
    : fallback.owners;
  const cases = Array.isArray(parsed.cases) && parsed.cases.length > 0
    ? parsed.cases.map(normalizeCase)
    : fallback.cases;
  const activeOwnerId = owners.some((owner) => owner.id === parsed.activeOwnerId && owner.active)
    ? parsed.activeOwnerId ?? null
    : owners.find((owner) => owner.active)?.id ?? null;

  return {
    owners,
    cases,
    auditLog: Array.isArray(parsed.auditLog) ? parsed.auditLog : [],
    activeOwnerId,
    themeMode: parsed.themeMode === "dark" ? "dark" : "light"
  };
}

function resolveActor(state: WorkspaceState) {
  return state.owners.find((owner) => owner.id === state.activeOwnerId) ?? null;
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
  state: WorkspaceState,
  actor: OwnerDirectoryEntry | null,
  payload: Omit<UserInteractionLog, "id" | "actorId" | "actorName" | "createdAt">
) {
  return {
    ...state,
    auditLog: [createAuditEntry(actor, payload), ...state.auditLog].slice(0, 300)
  };
}

export function KingestionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WorkspaceState>(() => createDefaultState());
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setState(restoreState(saved));
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [isHydrated, state]);

  useEffect(() => {
    document.documentElement.dataset.theme = state.themeMode;
  }, [state.themeMode]);

  useEffect(() => {
    if (state.activeOwnerId) return;

    const fallbackOwner = state.owners.find((owner) => owner.active);
    if (!fallbackOwner) return;

    setState((currentState) => {
      if (currentState.activeOwnerId) {
        return currentState;
      }

      return {
        ...currentState,
        activeOwnerId: fallbackOwner.id
      };
    });
  }, [state.activeOwnerId, state.owners]);

  const activeOwner = useMemo(
    () =>
      state.owners.find((owner) => owner.id === state.activeOwnerId && owner.active) ??
      state.owners.find((owner) => owner.active) ??
      null,
    [state.activeOwnerId, state.owners]
  );
  const canManageReimbursements = useMemo(
    () => canManageReimbursementForOwner(activeOwner),
    [activeOwner]
  );

  const openCases = useMemo(() => getOpenCases(state.cases), [state.cases]);
  const closedCases = useMemo(() => getClosedCases(state.cases), [state.cases]);
  const activeOwners = useMemo(
    () => state.owners.filter((owner) => owner.active),
    [state.owners]
  );
  const dashboardSnapshot = useMemo(
    () => getDashboardSnapshot(state.cases, state.owners),
    [state.cases, state.owners]
  );
  const reportsSnapshot = useMemo(
    () => getReportsSnapshot(state.cases, state.owners),
    [state.cases, state.owners]
  );

  const findCaseById = (caseId: string) => state.cases.find((entry) => entry.id === caseId);

  const setActiveOwner = (ownerId: string) => {
    setState((currentState) => {
      const nextOwner = currentState.owners.find((owner) => owner.id === ownerId && owner.active);
      if (!nextOwner) return currentState;

      return appendAuditLog(
        {
          ...currentState,
          activeOwnerId: nextOwner.id
        },
        nextOwner,
        {
          entityType: "session",
          entityId: nextOwner.id,
          action: "session-changed",
          detail: `Se cambio el usuario activo a ${nextOwner.name}.`
        }
      );
    });
  };

  const setThemeMode = (themeMode: ThemeMode) => {
    setState((currentState) => ({
      ...currentState,
      themeMode
    }));
  };

  const createCase = (input: CreateCaseInput) => {
    const normalizedClientName = input.clientName.trim();
    const normalizedContactName = input.contactName.trim();
    const normalizedOwner = input.owner.trim() || "Sin asignar";
    const normalizedAddress = input.address.trim();
    const normalizedProvince = input.province.trim();
    const normalizedCity = input.city.trim();
    const normalizedKingstonNumber = input.kingstonNumber.trim();
    const normalizedSku = input.sku.trim();
    const normalizedProductDescription = input.productDescription.trim();
    const normalizedFailureDescription = input.failureDescription.trim();
    const normalizedObservations = input.observations.trim();
    const trimmedNextAction = input.nextAction.trim();
    const fallbackClientDetails = clientDirectory[normalizedClientName];
    const now = new Date();
    const nowIso = now.toISOString();
    const nextCaseNumber = getNextInternalCaseNumber(state.cases);
    const caseId = `rma-${nextCaseNumber}`;
    const internalNumber = `RMA-${nextCaseNumber}`;
    const isTerminalStatus = input.externalStatus === "Realizado" || input.externalStatus === "Cerrado";
    const nextAction = isTerminalStatus
      ? getNextActionCopy(input.externalStatus)
      : trimmedNextAction || getNextActionCopy(input.externalStatus);
    const fullAddress = normalizedAddress || fallbackClientDetails?.fullAddress || "Direccion pendiente";
    const bankingValues = input.banking ?? {};
    const hasExplicitBanking = Object.values(bankingValues).some((value) => Boolean(value?.trim()));
    const banking =
      hasExplicitBanking || fallbackClientDetails?.banking
        ? {
            bankName: bankingValues.bankName?.trim() || fallbackClientDetails?.banking.bankName || "Banco pendiente",
            accountHolder:
              bankingValues.accountHolder?.trim() ||
              fallbackClientDetails?.banking.accountHolder ||
              normalizedClientName,
            cuit: bankingValues.cuit?.trim() || fallbackClientDetails?.banking.cuit || "CUIT pendiente",
            cbu: bankingValues.cbu?.trim() || fallbackClientDetails?.banking.cbu || "CBU pendiente",
            alias: bankingValues.alias?.trim() || fallbackClientDetails?.banking.alias || "ALIAS.PENDIENTE",
            accountNumber:
              bankingValues.accountNumber?.trim() ||
              fallbackClientDetails?.banking.accountNumber ||
              "Cuenta pendiente"
          }
        : undefined;

    setState((currentState) => {
      const actor = resolveActor(currentState);
      const actorName = actor?.name ?? "Sesion sin responsable activo";
      const logisticsAddress =
        input.deliveryMode === "Pickup"
          ? "Mostrador central ANYX"
          : [fullAddress, normalizedCity, normalizedProvince, "Argentina"].filter(Boolean).join(", ");

      const initialTask = isTerminalStatus
        ? []
        : [
            {
              id: createId("task"),
              title: "Validar caso",
              description: nextAction,
              type: "validation" as const,
              assignee: normalizedOwner,
              priority: input.priority,
              dueAt: addDays(now, getInitialTaskDueDays(input.priority)),
              state: "Pending" as const
            }
          ];

      const nextComments = normalizedObservations
        ? [
            {
              id: createId("comment"),
              author: actorName,
              body: normalizedObservations,
              internal: true,
              createdAt: nowIso
            }
          ]
        : [];

      const nextAttachments = (input.attachments ?? []).map((attachment) => ({
        id: createId("attachment"),
        name: attachment.name.trim(),
        kind: attachment.kind || inferAttachmentKind(attachment.name),
        sizeLabel: attachment.sizeLabel,
        uploadedBy: actorName,
        createdAt: nowIso,
        mimeType: attachment.mimeType,
        previewUrl: attachment.previewUrl
      }));

      const createdCase = normalizeCase({
        id: caseId,
        internalNumber,
        kingstonNumber: normalizedKingstonNumber,
        clientName: normalizedClientName,
        contactName: normalizedContactName,
        contactEmail: input.contactEmail.trim().toLowerCase(),
        contactPhone: input.contactPhone.trim(),
        zone: input.zone,
        deliveryMode: input.deliveryMode,
        priority: input.priority,
        owner: normalizedOwner,
        nextAction,
        externalStatus: input.externalStatus,
        internalSubstatus: getInitialSubstatus(input.externalStatus),
        openedAt: nowIso,
        updatedAt: nowIso,
        slaDueAt: addDays(now, getSlaDays(input.priority)),
        address: fullAddress,
        province: normalizedProvince,
        city: normalizedCity,
        sku: normalizedSku,
        replacementSku: input.replacementSku?.trim() || null,
        productDescription: normalizedProductDescription,
        quantity: input.quantity,
        failureDescription: normalizedFailureDescription,
        origin: input.origin,
        observations: normalizedObservations || "Sin observaciones cargadas.",
        banking,
        logistics: {
          mode: input.deliveryMode,
          address: logisticsAddress,
          transporter: null,
          guideNumber: null,
          trackingUrl: null,
          dispatchDate: null,
          deliveredDate: isTerminalStatus ? nowIso : null,
          shippingCost: null,
          reimbursementState:
            input.deliveryMode === "Pickup"
              ? "Not applicable"
              : input.zone === "Interior / Gran Buenos Aires" &&
                  input.externalStatus === "Producto recepcionado y en preparacion"
                ? nextAttachments.some((attachment) => attachment.kind === "proof" || attachment.kind === "photo")
                  ? "Requested"
                  : "Pending"
                : "Not applicable"
        },
        procurement: {
          localStock: input.externalStatus === "Pedido a Kingston" ? "Unavailable" : "Pending",
          wholesalerStock: input.externalStatus === "Pedido a Kingston" ? "Unavailable" : "Pending",
          wholesalerName: null,
          requiresKingstonOrder: input.externalStatus === "Pedido a Kingston",
          kingstonRequestedAt: input.externalStatus === "Pedido a Kingston" ? nowIso : null,
          receivedFromUsaAt: null,
          releasedByPurchasing: false,
          releasedAt: null,
          movedToRmaWarehouse: false,
          movedToRmaWarehouseAt: null
        },
        tasks: initialTask,
        comments: nextComments,
        attachments: nextAttachments,
        events: [
          {
            id: createId("event"),
            kind: "status-change",
            title: "Caso creado",
            detail: `${internalNumber} se creo en ${input.externalStatus} para ${normalizedClientName}.`,
            actor: actorName,
            createdAt: nowIso
          }
        ]
      });

      return appendAuditLog(
        {
          ...currentState,
          cases: [createdCase, ...currentState.cases]
        },
        actor,
        {
          entityType: "case",
          entityId: caseId,
          action: "case-created",
          detail: `Se creo ${internalNumber} para ${normalizedClientName}.`
        }
      );
    });

    return caseId;
  };

  const addCaseAttachment = (caseId: string, input: CaseAttachmentInput) => {
    const targetCase = state.cases.find((entry) => entry.id === caseId);
    if (!targetCase) {
      return false;
    }

    setState((currentState) => {
      const actor = resolveActor(currentState);
      const actorName = actor?.name ?? "Sesion sin responsable activo";
      const now = new Date().toISOString();

      const nextCases: KingstonCase[] = currentState.cases.map((entry): KingstonCase => {
        if (entry.id !== caseId) {
          return entry;
        }

        const nextAttachment: CaseAttachment = {
          id: createId("attachment"),
          name: input.name.trim(),
          kind: input.kind || inferAttachmentKind(input.name),
          sizeLabel: input.sizeLabel,
          uploadedBy: actorName,
          createdAt: now,
          mimeType: input.mimeType,
          previewUrl: input.previewUrl
        };

        const nextEvent: CaseEvent = {
          id: createId("event"),
          kind: "attachment",
          title: "Adjunto cargado",
          detail: `${nextAttachment.name} se sumo al caso.`,
          actor: actorName,
          createdAt: now
        };
        const reimbursementState: KingstonCase["logistics"]["reimbursementState"] =
          (nextAttachment.kind === "proof" || nextAttachment.kind === "photo") &&
          entry.logistics.reimbursementState === "Pending"
            ? "Requested"
            : entry.logistics.reimbursementState;

        return {
          ...entry,
          updatedAt: now,
          attachments: [nextAttachment, ...entry.attachments],
          logistics: {
            ...entry.logistics,
            reimbursementState
          },
          events: [nextEvent, ...entry.events]
        };
      });

      return appendAuditLog(
        {
          ...currentState,
          cases: nextCases
        },
        actor,
        {
          entityType: "case",
          entityId: caseId,
          action: "case-attachment-added",
          detail: `${targetCase.internalNumber} recibio el adjunto ${input.name.trim()}.`
        }
      );
    });

    return true;
  };

  const removeCaseAttachment = (caseId: string, attachmentId: string) => {
    const targetCase = state.cases.find((entry) => entry.id === caseId);
    const targetAttachment = targetCase?.attachments.find((attachment) => attachment.id === attachmentId);
    if (!targetCase || !targetAttachment) {
      return false;
    }

    setState((currentState) => {
      const actor = resolveActor(currentState);
      const actorName = actor?.name ?? "Sesion sin responsable activo";
      const now = new Date().toISOString();

      const nextCases: KingstonCase[] = currentState.cases.map((entry): KingstonCase => {
        if (entry.id !== caseId) {
          return entry;
        }

        const remainingAttachments = entry.attachments.filter((attachment) => attachment.id !== attachmentId);
        const hasProofAttachment = remainingAttachments.some(
          (attachment) => attachment.kind === "proof" || attachment.kind === "photo"
        );

        const nextEvent: CaseEvent = {
          id: createId("event"),
          kind: "attachment",
          title: "Adjunto eliminado",
          detail: `${targetAttachment.name} se elimino del caso.`,
          actor: actorName,
          createdAt: now
        };

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
          events: [nextEvent, ...entry.events]
        };
      });

      return appendAuditLog(
        {
          ...currentState,
          cases: nextCases
        },
        actor,
        {
          entityType: "case",
          entityId: caseId,
          action: "case-attachment-removed",
          detail: `${targetCase.internalNumber} elimino el adjunto ${targetAttachment.name}.`
        }
      );
    });

    return true;
  };

  const updateReplacementSku = (caseId: string, replacementSku: string) => {
    const targetCase = state.cases.find((entry) => entry.id === caseId);
    if (!targetCase) {
      return false;
    }

    setState((currentState) => {
      const actor = resolveActor(currentState);
      const normalizedReplacementSku = replacementSku.trim() || null;
      const now = new Date().toISOString();

      const nextCases: KingstonCase[] = currentState.cases.map((entry): KingstonCase => {
        if (entry.id !== caseId) {
          return entry;
        }

        const nextEvent: CaseEvent = {
          id: createId("event"),
          kind: "procurement",
          title: "SKU de reemplazo actualizado",
          detail: normalizedReplacementSku
            ? `Se definio ${normalizedReplacementSku} como SKU de reemplazo.`
            : "Se limpio el SKU de reemplazo del caso.",
          actor: actor?.name ?? "Sesion sin responsable activo",
          createdAt: now
        };

        return {
          ...entry,
          replacementSku: normalizedReplacementSku,
          updatedAt: now,
          events: [nextEvent, ...entry.events]
        };
      });

      return appendAuditLog(
        {
          ...currentState,
          cases: nextCases
        },
        actor,
        {
          entityType: "case",
          entityId: caseId,
          action: "case-replacement-sku-updated",
          detail: normalizedReplacementSku
            ? `${targetCase.internalNumber} ahora usa ${normalizedReplacementSku} como SKU de reemplazo.`
            : `Se removio el SKU de reemplazo de ${targetCase.internalNumber}.`
        }
      );
    });

    return true;
  };

  const completeReimbursement = (caseId: string) => {
    if (!canManageReimbursementForOwner(activeOwner)) {
      return false;
    }

    const targetCase = state.cases.find((entry) => entry.id === caseId);
    if (!targetCase) {
      return false;
    }

    setState((currentState) => {
      const actor = resolveActor(currentState);
      const now = new Date().toISOString();

      const nextCases: KingstonCase[] = currentState.cases.map((entry): KingstonCase => {
        if (entry.id !== caseId) {
          return entry;
        }

        const nextEvent: CaseEvent = {
          id: createId("event"),
          kind: "logistics",
          title: "Reintegro completado",
          detail: "El reintegro quedo marcado como completado.",
          actor: actor?.name ?? "Sesion sin responsable activo",
          createdAt: now
        };

        return {
          ...entry,
          updatedAt: now,
          logistics: {
            ...entry.logistics,
            reimbursementState: "Completed" as KingstonCase["logistics"]["reimbursementState"]
          },
          events: [nextEvent, ...entry.events]
        };
      });

      return appendAuditLog(
        {
          ...currentState,
          cases: nextCases
        },
        actor,
        {
          entityType: "case",
          entityId: caseId,
          action: "case-reimbursement-completed",
          detail: `Se completo el reintegro de ${targetCase.internalNumber}.`
        }
      );
    });

    return true;
  };

  const createOwner = (input: OwnerInput) => {
    setState((currentState) => {
      const actor = resolveActor(currentState);
      const nextOwner: OwnerDirectoryEntry = {
        id: createId("owner"),
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        team: input.team,
        active: input.active,
        initials: buildInitials(input.name)
      };

      return appendAuditLog(
        {
          ...currentState,
          owners: [...currentState.owners, nextOwner],
          activeOwnerId:
            currentState.activeOwnerId ??
            (nextOwner.active ? nextOwner.id : null)
        },
        actor,
        {
          entityType: "owner",
          entityId: nextOwner.id,
          action: "owner-created",
          detail: `Se agrego a ${nextOwner.name} dentro de ${nextOwner.team}.`
        }
      );
    });
  };

  const updateOwner = (ownerId: string, input: OwnerInput) => {
    setState((currentState) => {
      const actor = resolveActor(currentState);
      const previousOwner = currentState.owners.find((owner) => owner.id === ownerId);
      if (!previousOwner) return currentState;

      const nextOwner: OwnerDirectoryEntry = {
        ...previousOwner,
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        team: input.team,
        active: input.active,
        initials: buildInitials(input.name)
      };

      const updatedCases: KingstonCase[] = currentState.cases.map((entry) => {
        const owner = entry.owner === previousOwner.name ? nextOwner.name : entry.owner;
        const tasks: KingstonCase["tasks"] = entry.tasks.map((task) =>
          task.assignee === previousOwner.name
            ? {
                ...task,
                assignee: nextOwner.name
              }
            : task
        );

        return {
          ...entry,
          owner,
          tasks
        };
      });

      const fallbackOwnerId =
        !nextOwner.active && currentState.activeOwnerId === nextOwner.id
          ? currentState.owners.find((owner) => owner.id !== nextOwner.id && owner.active)?.id ?? null
          : currentState.activeOwnerId;

      return appendAuditLog(
        {
          ...currentState,
          owners: currentState.owners.map((owner) => (owner.id === ownerId ? nextOwner : owner)),
          cases: updatedCases,
          activeOwnerId: fallbackOwnerId
        },
        actor,
        {
          entityType: "owner",
          entityId: ownerId,
          action: "owner-updated",
          detail: `Se actualizo el responsable ${previousOwner.name}.`
        }
      );
    });
  };

  const deleteOwner = (ownerId: string) => {
    setState((currentState) => {
      const actor = resolveActor(currentState);
      const removedOwner = currentState.owners.find((owner) => owner.id === ownerId);
      if (!removedOwner) return currentState;

      const remainingOwners = currentState.owners.filter((owner) => owner.id !== ownerId);
      const nextActiveOwnerId =
        currentState.activeOwnerId === ownerId
          ? remainingOwners.find((owner) => owner.active)?.id ?? null
          : currentState.activeOwnerId;

      const updatedCases: KingstonCase[] = currentState.cases.map((entry) => ({
        ...entry,
        owner: entry.owner === removedOwner.name ? "Sin asignar" : entry.owner,
        tasks: entry.tasks.map((task) =>
          task.assignee === removedOwner.name
            ? {
                ...task,
                assignee: "Sin asignar"
              }
            : task
        )
      }));

      return appendAuditLog(
        {
          ...currentState,
          owners: remainingOwners,
          cases: updatedCases,
          activeOwnerId: nextActiveOwnerId
        },
        actor,
        {
          entityType: "owner",
          entityId: ownerId,
          action: "owner-deleted",
          detail: `Se elimino a ${removedOwner.name} y las asignaciones quedaron liberadas.`
        }
      );
    });
  };

  const assignCaseOwner = (caseId: string, ownerName: string) => {
    setState((currentState) => {
      const actor = resolveActor(currentState);
      const targetCase = currentState.cases.find((entry) => entry.id === caseId);
      if (!targetCase || targetCase.owner === ownerName) return currentState;

      const nextCases: KingstonCase[] = currentState.cases.map((entry) =>
        entry.id === caseId
          ? (() => {
              const nextEvent: CaseEvent = {
                id: createId("event"),
                kind: "task",
                title: "Responsable actualizado",
                detail: `El caso quedo asignado a ${ownerName}.`,
                actor: actor?.name ?? "Sesion sin responsable activo",
                createdAt: new Date().toISOString()
              };

              return {
                ...entry,
                owner: ownerName,
                updatedAt: new Date().toISOString(),
                events: [nextEvent, ...entry.events]
              };
            })()
          : entry
      );

      return appendAuditLog(
        {
          ...currentState,
          cases: nextCases
        },
        actor,
        {
          entityType: "case",
          entityId: caseId,
          action: "case-owner-updated",
          detail: `Se asigno ${targetCase.internalNumber} a ${ownerName}.`
        }
      );
    });
  };

  const updateCaseStatus = (caseId: string, status: ExternalStatus) => {
    setState((currentState) => {
      const actor = resolveActor(currentState);
      const targetCase = currentState.cases.find((entry) => entry.id === caseId);
      if (!targetCase || targetCase.externalStatus === status) return currentState;

      const workflowState = workflowStates.find((entry) => entry.status === status);
      const now = new Date().toISOString();

      const nextCases: KingstonCase[] = currentState.cases.map((entry) => {
        if (entry.id !== caseId) return entry;

        const nextTasks: KingstonCase["tasks"] = entry.tasks.map((task) => {
          if (status === "Realizado" || status === "Cerrado") {
            return {
              ...task,
              state: "Completed"
            };
          }

          return task;
        });

        const nextEvent: CaseEvent = {
          id: createId("event"),
          kind: "status-change",
          title: `Estado actualizado a ${status}`,
          detail: `El caso avanzo desde ${targetCase.externalStatus} hacia ${status}.`,
          actor: actor?.name ?? "Sesion sin responsable activo",
          createdAt: now
        };

        return {
          ...entry,
          externalStatus: status,
          internalSubstatus: workflowState?.substatuses[0] ?? getInitialSubstatus(status),
          nextAction: getNextActionCopy(status),
          updatedAt: now,
          logistics: {
            ...entry.logistics,
            reimbursementState:
              entry.zone === "Interior / Gran Buenos Aires" &&
              status === "Producto recepcionado y en preparacion" &&
              entry.logistics.reimbursementState !== "Completed"
                ? entry.attachments.some(
                    (attachment) => attachment.kind === "proof" || attachment.kind === "photo"
                  )
                  ? "Requested"
                  : "Pending"
                : entry.logistics.reimbursementState,
            deliveredDate:
              status === "Realizado" && !entry.logistics.deliveredDate ? now : entry.logistics.deliveredDate
          },
          tasks: nextTasks,
          events: [nextEvent, ...entry.events]
        };
      });

      return appendAuditLog(
        {
          ...currentState,
          cases: nextCases
        },
        actor,
        {
          entityType: "case",
          entityId: caseId,
          action: "case-status-updated",
          detail: `${targetCase.internalNumber} cambio de ${targetCase.externalStatus} a ${status}.`
        }
      );
    });
  };

  const recordCaseView = (caseId: string) => {
    setState((currentState) => {
      const actor = resolveActor(currentState);
      const entry = currentState.cases.find((item) => item.id === caseId);
      if (!entry) return currentState;

      return appendAuditLog(currentState, actor, {
        entityType: "case",
        entityId: caseId,
        action: "case-viewed",
        detail: `Se consulto el caso ${entry.internalNumber}.`
      });
    });
  };

  const recordReportDownload = (reportName: string) => {
    setState((currentState) => {
      const actor = resolveActor(currentState);

      return appendAuditLog(currentState, actor, {
        entityType: "report",
        entityId: reportName,
        action: "report-downloaded",
        detail: `Se descargo el reporte ${reportName}.`
      });
    });
  };

  const value = useMemo<KingestionContextValue>(
    () => ({
      ...state,
      activeOwner,
      openCases,
      closedCases,
      activeOwners,
      canManageReimbursements,
      themeMode: state.themeMode,
      dashboardSnapshot,
      reportsSnapshot,
      findCaseById,
      setActiveOwner,
      setThemeMode,
      createCase,
      addCaseAttachment,
      removeCaseAttachment,
      updateReplacementSku,
      completeReimbursement,
      createOwner,
      updateOwner,
      deleteOwner,
      assignCaseOwner,
      updateCaseStatus,
      recordCaseView,
      recordReportDownload
    }),
    [
      state,
      activeOwner,
      openCases,
      closedCases,
      activeOwners,
      canManageReimbursements,
      dashboardSnapshot,
      reportsSnapshot
    ]
  );

  return <KingestionContext.Provider value={value}>{children}</KingestionContext.Provider>;
}

export function useKingestion() {
  const context = useContext(KingestionContext);

  if (!context) {
    throw new Error("useKingestion debe usarse dentro de KingestionProvider.");
  }

  return context;
}
