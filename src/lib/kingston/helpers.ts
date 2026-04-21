import {
  archivedCasesSeed,
  getDefaultPermissionsForRole,
  kingstonCases,
  ownerDirectory,
  referenceNow,
  workflowStates
} from "@/lib/kingston/data";
import type {
  DeliveryMode,
  EventKind,
  ExternalStatus,
  KingstonCase,
  ModulePermissionKey,
  ModulePermissions,
  OwnerDirectoryEntry,
  UserRole,
  Zone
} from "@/lib/kingston/types";

const numberFormatter = new Intl.NumberFormat("es-AR");

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric"
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit"
});

const ZONE_WORKFLOW_ORDER: Record<Zone, ExternalStatus[]> = {
  "Interior / Gran Buenos Aires": [
    "Informado",
    "Aviso de envio",
    "Producto recepcionado y en preparacion",
    "Pedido Kingston",
    "Pedido deposito y etiquetado",
    "Liberar mercaderia",
    "OV creada",
    "Pedido guia",
    "Producto enviado",
    "Realizado",
    "Vencido",
    "Cerrado"
  ],
  "Capital / AMBA": [
    "Informado",
    "Producto recepcionado y en preparacion",
    "Pedido Kingston",
    "Pedido deposito y etiquetado",
    "Liberar mercaderia",
    "OV creada",
    "Producto listo para retiro",
    "Realizado",
    "Vencido",
    "Cerrado"
  ]
};

const LEGACY_STATUS_MAP: Record<string, ExternalStatus> = {
  "Pedido etiqueta": "Pedido deposito y etiquetado",
  "Pedido deposito": "Pedido deposito y etiquetado",
  "Pedido a Kingston": "Pedido Kingston",
  "OV cargada": "OV creada"
};

const CLOSED_CASE_STATUSES: ExternalStatus[] = ["Realizado", "Vencido", "Cerrado"];

function fallbackInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "NA";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

export function getReferenceDate() {
  return new Date(referenceNow);
}

export function formatDate(date: string) {
  return dateFormatter.format(new Date(date));
}

export function formatDateTime(date: string) {
  return dateTimeFormatter.format(new Date(date));
}

export function formatCount(value: number) {
  return numberFormatter.format(value);
}

export function normalizeStatus(status: string): ExternalStatus {
  return LEGACY_STATUS_MAP[status] ?? (status as ExternalStatus);
}

export function getOwnerInitials(name: string, owners: OwnerDirectoryEntry[] = ownerDirectory) {
  return owners.find((entry) => entry.name === name)?.initials ?? fallbackInitials(name);
}

export function getOwnerRole(name: string, owners: OwnerDirectoryEntry[] = ownerDirectory) {
  if (name === "Sin asignar") {
    return "UNASSIGNED";
  }

  return owners.find((entry) => entry.name === name)?.team ?? "TECHNICAL_SERVICE";
}

export function getTeamLabel(team: string) {
  switch (team) {
    case "ADMIN":
      return "Administrador";
    case "SALES":
      return "Ventas";
    case "TECHNICAL_SERVICE":
      return "Servicio tecnico";
    case "PURCHASING":
      return "Compras";
    case "PAYMENTS":
      return "Pagos";
    case "UNASSIGNED":
      return "Sin asignar";
    default:
      return team;
  }
}

export function getRoleLabel(role: UserRole) {
  return getTeamLabel(role);
}

export function getDeliveryModeLabel(mode: DeliveryMode) {
  return mode === "Dispatch" ? "Envio" : "Retiro";
}

export function getPriorityLabel(priority: string) {
  switch (priority) {
    case "Low":
      return "Baja";
    case "Medium":
      return "Media";
    case "High":
      return "Alta";
    case "Critical":
      return "Critica";
    default:
      return priority;
  }
}

export function getTaskStateLabel(state: string) {
  switch (state) {
    case "Pending":
      return "Pendiente";
    case "In progress":
      return "En curso";
    case "Completed":
      return "Completada";
    case "Blocked":
      return "Bloqueada";
    default:
      return state;
  }
}

export function getAvailabilityLabel(value: string) {
  switch (value) {
    case "Available":
      return "Disponible";
    case "Unavailable":
      return "Sin stock";
    case "Pending":
      return "Pendiente";
    default:
      return value;
  }
}

export function getReimbursementStateLabel(value: string) {
  switch (value) {
    case "Pending":
      return "Pendiente de reintegro";
    case "Not applicable":
      return "No aplica";
    case "Requested":
      return "Comprobante cargado";
    case "Completed":
      return "Completado";
    default:
      return value;
  }
}

export function getAttachmentKindLabel(kind: string) {
  switch (kind) {
    case "mail":
      return "Correo";
    case "photo":
      return "Foto";
    case "proof":
      return "Comprobante";
    case "guide":
      return "Guia";
    case "form":
      return "Formulario";
    default:
      return kind;
  }
}

export function getEventKindLabel(kind: EventKind) {
  switch (kind) {
    case "status-change":
      return "Cambio de estado";
    case "task":
      return "Tarea";
    case "logistics":
      return "Logistica";
    case "procurement":
      return "Abastecimiento";
    case "comment":
      return "Comentario";
    case "attachment":
      return "Adjunto";
    default:
      return kind;
  }
}

export function getWorkflowCategoryLabel(value: string) {
  switch (value) {
    case "service":
      return "Servicio";
    case "purchasing":
      return "Compras";
    case "delivery":
      return "Entrega";
    case "terminal":
      return "Terminal";
    default:
      return value;
  }
}

export function getOriginLabel(value: string) {
  switch (value) {
    case "Kingston email":
      return "Correo de Kingston";
    case "Operations load":
      return "Carga de operaciones";
    case "Commercial handoff":
      return "Pase comercial";
    default:
      return value;
  }
}

export function getAuditActionLabel(action: string) {
  switch (action) {
    case "case-created":
      return "Alta de caso";
    case "case-attachment-added":
      return "Adjunto cargado";
    case "case-attachment-removed":
      return "Adjunto eliminado";
    case "case-replacement-sku-updated":
      return "SKU de reemplazo";
    case "case-reimbursement-completed":
      return "Reintegro completado";
    case "case-status-updated":
      return "Cambio de estado";
    case "case-owner-updated":
      return "Cambio de responsable";
    case "case-deleted":
      return "Caso eliminado";
    case "user-created":
      return "Alta de usuario";
    case "user-updated":
      return "Edicion de usuario";
    case "user-deleted":
      return "Usuario eliminado";
    case "user-password-updated":
      return "Clave actualizada";
    case "session-login":
      return "Inicio de sesion";
    case "session-logout":
      return "Cierre de sesion";
    case "case-viewed":
      return "Consulta de caso";
    case "report-downloaded":
      return "Descarga de reporte";
    default:
      return action;
  }
}

export function getCaseById(caseId: string, cases: KingstonCase[] = [...kingstonCases, ...archivedCasesSeed]) {
  return cases.find((entry) => entry.id === caseId);
}

export function getCaseAgingDays(entry: KingstonCase) {
  const diff = getReferenceDate().getTime() - new Date(entry.openedAt).getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function getHoursUntilDue(date: string) {
  const diff = new Date(date).getTime() - getReferenceDate().getTime();
  return Math.round(diff / (1000 * 60 * 60));
}

export function getSlaTone(date: string) {
  const hours = getHoursUntilDue(date);
  if (hours < 0) return "danger";
  if (hours <= 24) return "warning";
  return "neutral";
}

export function getSlaLabel(date: string) {
  const hours = getHoursUntilDue(date);
  if (hours < 0) {
    return `Atrasado ${Math.abs(hours)}h`;
  }

  if (hours <= 24) {
    return `Vence en ${hours}h`;
  }

  const days = Math.ceil(hours / 24);
  return `Vence en ${days}d`;
}

export function isStatusAvailableForZone(status: ExternalStatus, zone: Zone) {
  return workflowStates.some((entry) => entry.status === status && entry.zones.includes(zone));
}

export function getWorkflowState(status: ExternalStatus, zone?: Zone) {
  return workflowStates.find((entry) => entry.status === status && (!zone || entry.zones.includes(zone)));
}

export function getZoneWorkflowSteps(zone: Zone, options?: { includeTerminal?: boolean }) {
  return workflowStates
    .filter(
      (entry) => entry.zones.includes(zone) && ((options?.includeTerminal ?? true) || entry.category !== "terminal")
    )
    .toSorted((left, right) => left.order - right.order);
}

export function getWorkflowOrder(status: ExternalStatus, zone: Zone) {
  return ZONE_WORKFLOW_ORDER[zone].indexOf(status);
}

export function getInitialSubstatus(status: ExternalStatus, zone?: Zone) {
  return getWorkflowState(status, zone)?.substatuses[0] ?? status;
}

export function getNextActionCopy(status: ExternalStatus) {
  if (status === "Realizado" || status === "Vencido" || status === "Cerrado") {
    return "Caso fuera de la bandeja operativa. No requiere una proxima accion abierta.";
  }

  return getWorkflowState(status)?.description ?? "Definir proxima accion operativa.";
}

export function getAllowedStatusesForZone(zone: Zone, options?: { includeTerminal?: boolean }) {
  return getZoneWorkflowSteps(zone, options).map((entry) => entry.status);
}

export function isReimbursementZone(zone: KingstonCase["zone"]) {
  return zone === "Interior / Gran Buenos Aires";
}

export function hasReachedReimbursementTrigger(status: ExternalStatus, zone: Zone) {
  return getWorkflowOrder(status, zone) >= getWorkflowOrder("Producto recepcionado y en preparacion", zone);
}

export function shouldTrackReimbursement(entry: KingstonCase) {
  return (
    isReimbursementZone(entry.zone) &&
    (hasReachedReimbursementTrigger(entry.externalStatus, entry.zone) ||
      entry.logistics.reimbursementState === "Pending" ||
      entry.logistics.reimbursementState === "Requested" ||
      entry.logistics.reimbursementState === "Completed")
  );
}

export function isTerminalStatus(status: ExternalStatus) {
  return getWorkflowState(status)?.category === "terminal";
}

export function isClosedCaseStatus(status: ExternalStatus) {
  return CLOSED_CASE_STATUSES.includes(status);
}

export function getOpenCases(cases: KingstonCase[] = kingstonCases) {
  return cases.filter((entry) => !isClosedCaseStatus(entry.externalStatus));
}

export function getClosedCases(cases: KingstonCase[] = archivedCasesSeed) {
  return cases.filter((entry) => isClosedCaseStatus(entry.externalStatus));
}

export function getPendingReimbursements(cases: KingstonCase[] = kingstonCases) {
  return cases.filter((entry) => shouldTrackReimbursement(entry) && entry.logistics.reimbursementState !== "Completed");
}

export function getPendingPurchasesCases(cases: KingstonCase[] = kingstonCases) {
  return getOpenCases(cases).filter(
    (entry) => entry.externalStatus === "Liberar mercaderia" || entry.externalStatus === "OV creada"
  );
}

export function getPendingTechnicalCases(cases: KingstonCase[] = kingstonCases) {
  return getOpenCases(cases).filter(
    (entry) =>
      entry.externalStatus === "Informado" || entry.externalStatus === "Pedido deposito y etiquetado"
  );
}

export function flattenTasks(cases: KingstonCase[] = kingstonCases) {
  return cases.flatMap((entry) =>
    entry.tasks.map((task) => ({
      ...task,
      caseId: entry.id,
      caseNumber: entry.internalNumber,
      clientName: entry.clientName,
      externalStatus: entry.externalStatus
    }))
  );
}

export function getTaskBuckets(cases: KingstonCase[] = kingstonCases) {
  const tasks = flattenTasks(cases);
  const now = getReferenceDate().getTime();

  return {
    overdue: tasks.filter((task) => task.state !== "Completed" && new Date(task.dueAt).getTime() < now),
    dueSoon: tasks.filter((task) => {
      const dueAt = new Date(task.dueAt).getTime();
      return task.state !== "Completed" && dueAt >= now && dueAt - now <= 1000 * 60 * 60 * 24;
    }),
    active: tasks.filter((task) => task.state === "In progress"),
    blocked: tasks.filter((task) => task.state === "Blocked")
  };
}

export function getDashboardSnapshot(
  cases: KingstonCase[] = kingstonCases,
  owners: OwnerDirectoryEntry[] = ownerDirectory
) {
  const openCases = getOpenCases(cases);
  const closedCases = getClosedCases(cases);
  const taskBuckets = getTaskBuckets(cases);

  const byZone = Array.from(
    openCases.reduce((map, entry) => {
      map.set(entry.zone, (map.get(entry.zone) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  ).map(([label, value]) => ({ label, value }));

  const byStatus = workflowStates
    .filter((state) => state.category !== "terminal")
    .map((state) => ({
      status: state.status,
      count: openCases.filter((entry) => entry.externalStatus === state.status).length,
      category: state.category
    }))
    .filter((entry) => entry.count > 0);

  const assignedOwners = owners.filter((owner) => owner.active);
  const ownerLoad: Array<{ owner: string; team: string; count: number }> = assignedOwners.map((owner) => ({
    owner: owner.name,
    team: owner.team,
    count: openCases.filter((entry) => entry.owner === owner.name).length
  }));

  const unassignedCount = openCases.filter(
    (entry) => !assignedOwners.some((owner) => owner.name === entry.owner)
  ).length;

  if (unassignedCount > 0) {
    ownerLoad.push({ owner: "Sin asignar", team: "UNASSIGNED", count: unassignedCount });
  }

  const averageAging = Math.round(
    openCases.reduce((sum, entry) => sum + getCaseAgingDays(entry), 0) / Math.max(openCases.length, 1)
  );

  const criticalCases = [...openCases]
    .filter(
      (entry) =>
        getSlaTone(entry.slaDueAt) !== "neutral" ||
        entry.priority === "Critical" ||
        entry.externalStatus === "Pedido Kingston"
    )
    .sort((left, right) => new Date(left.slaDueAt).getTime() - new Date(right.slaDueAt).getTime())
    .slice(0, 5);

  return {
    headlineMetrics: [
      { label: "Casos abiertos", value: openCases.length, hint: "Bandeja operativa con estados activos" },
      { label: "Casos cerrados", value: closedCases.length, hint: "Realizados, vencidos o cerrados" },
      { label: "SLA comprometido", value: taskBuckets.overdue.length, hint: "Tareas o casos fuera de ventana" },
      {
        label: "Pedido Kingston",
        value: openCases.filter((entry) => entry.externalStatus === "Pedido Kingston").length,
        hint: "Casos esperando reposicion o arribo"
      }
    ],
    openCases,
    closedCases,
    taskBuckets,
    byZone,
    byStatus,
    ownerLoad,
    averageAging,
    criticalCases
  };
}

export function getCasesIndex(
  filters:
    | {
        q?: string;
        status?: string;
        zone?: string;
        owner?: string;
        delivery?: string;
      }
    | undefined,
  cases: KingstonCase[] = kingstonCases
) {
  const q = filters?.q?.trim().toLowerCase();

  return cases.filter((entry) => {
    const matchesQuery =
      !q ||
      [
        entry.internalNumber,
        entry.kingstonNumber,
        entry.clientName,
        entry.sku,
        entry.productDescription,
        entry.owner,
        entry.address,
        entry.city,
        entry.province
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);

    const matchesStatus = !filters?.status || entry.externalStatus === filters.status;
    const matchesZone = !filters?.zone || entry.zone === filters.zone;
    const matchesOwner = !filters?.owner || entry.owner === filters.owner;
    const matchesDelivery = !filters?.delivery || entry.deliveryMode === (filters.delivery as DeliveryMode);

    return matchesQuery && matchesStatus && matchesZone && matchesOwner && matchesDelivery;
  });
}

export function getSearchParamValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function getStatusTone(status: ExternalStatus) {
  if (status === "Pedido Kingston") return "danger";
  if (status === "Realizado") return "success";
  if (status === "Vencido" || status === "Cerrado") return "warning";
  if (
    status === "Pedido deposito y etiquetado" ||
    status === "Liberar mercaderia" ||
    status === "OV creada" ||
    status === "Pedido guia" ||
    status === "Producto enviado" ||
    status === "Producto listo para retiro"
  ) {
    return "accent";
  }

  return "neutral";
}

export function getReportsSnapshot(cases: KingstonCase[] = kingstonCases, owners: OwnerDirectoryEntry[] = ownerDirectory) {
  const byClient = Array.from(
    cases.reduce((map, entry) => {
      map.set(entry.clientName, (map.get(entry.clientName) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  )
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value);

  const bySku = Array.from(
    cases.reduce((map, entry) => {
      map.set(entry.sku, (map.get(entry.sku) ?? 0) + entry.quantity);
      return map;
    }, new Map<string, number>())
  )
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value);

  const completedCases = cases.filter((entry) => entry.externalStatus === "Realizado");
  const closedCases = getClosedCases(cases);

  return {
    throughput: [
      { label: "Realizados", value: completedCases.length, hint: "Casos finalizados con entrega confirmada" },
      {
        label: "Pedido Kingston",
        value: getOpenCases(cases).filter((entry) => entry.externalStatus === "Pedido Kingston").length,
        hint: "Casos que dependen de reposicion o arribo"
      },
      { label: "Cerrados", value: closedCases.length, hint: "Casos derivados al archivo final" },
      {
        label: "Aging promedio",
        value: getDashboardSnapshot(cases, owners).averageAging,
        hint: "Dias promedio dentro de la bandeja operativa"
      }
    ],
    byClient,
    bySku
  };
}

export function buildCaseAddress(entry: KingstonCase) {
  if (entry.address.includes(entry.city) || entry.address.includes(entry.province)) {
    return entry.address;
  }

  return `${entry.address}, ${entry.city}, ${entry.province}, Argentina`;
}

export function createEmptyPermissions() {
  return getDefaultPermissionsForRole("SALES");
}

export function canAccessModule(permissions: ModulePermissions, moduleKey: ModulePermissionKey) {
  return permissions[moduleKey]?.view ?? false;
}

export function canManageModule(permissions: ModulePermissions, moduleKey: ModulePermissionKey) {
  return permissions[moduleKey]?.manage ?? false;
}
