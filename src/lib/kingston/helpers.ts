import { kingstonCases, ownerDirectory, referenceNow, workflowStates } from "@/lib/kingston/data";
import type { DeliveryMode, EventKind, ExternalStatus, KingstonCase } from "@/lib/kingston/types";

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

export function getOwnerInitials(name: string) {
  return ownerDirectory.find((entry) => entry.name === name)?.initials ?? name.slice(0, 2).toUpperCase();
}

export function getOwnerTeam(name: string) {
  return ownerDirectory.find((entry) => entry.name === name)?.team ?? "Operations";
}

export function getTeamLabel(team: string) {
  switch (team) {
    case "Operations":
      return "Operaciones";
    case "Logistics":
      return "Logistica";
    case "Purchasing":
      return "Compras";
    case "Warehouse":
      return "Deposito";
    case "Management":
      return "Gerencia";
    default:
      return team;
  }
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
      return "Pendiente";
    case "Not applicable":
      return "No aplica";
    case "Requested":
      return "Solicitado";
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
    case "active":
      return "Activo";
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

export function getCaseById(caseId: string) {
  return kingstonCases.find((entry) => entry.id === caseId);
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

export function isTerminalStatus(status: ExternalStatus) {
  return workflowStates.find((entry) => entry.status === status)?.category === "terminal";
}

export function getOpenCases() {
  return kingstonCases.filter((entry) => !isTerminalStatus(entry.externalStatus));
}

export function flattenTasks() {
  return kingstonCases.flatMap((entry) =>
    entry.tasks.map((task) => ({
      ...task,
      caseId: entry.id,
      caseNumber: entry.internalNumber,
      clientName: entry.clientName,
      externalStatus: entry.externalStatus
    }))
  );
}

export function getTaskBuckets() {
  const tasks = flattenTasks();
  const now = getReferenceDate().getTime();

  return {
    overdue: tasks.filter(
      (task) => task.state !== "Completed" && new Date(task.dueAt).getTime() < now
    ),
    dueSoon: tasks.filter((task) => {
      const dueAt = new Date(task.dueAt).getTime();
      return task.state !== "Completed" && dueAt >= now && dueAt - now <= 1000 * 60 * 60 * 24;
    }),
    active: tasks.filter((task) => task.state === "In progress"),
    blocked: tasks.filter((task) => task.state === "Blocked")
  };
}

export function getDashboardSnapshot() {
  const openCases = getOpenCases();
  const taskBuckets = getTaskBuckets();

  const byZone = Array.from(
    openCases.reduce((map, entry) => {
      map.set(entry.zone, (map.get(entry.zone) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  ).map(([label, value]) => ({ label, value }));

  const byStatus = workflowStates
    .map((state) => ({
      status: state.status,
      count: openCases.filter((entry) => entry.externalStatus === state.status).length,
      category: state.category
    }))
    .filter((entry) => entry.count > 0);

  const ownerLoad = ownerDirectory.map((owner) => ({
    owner: owner.name,
    team: owner.team,
    count: openCases.filter((entry) => entry.owner === owner.name).length
  }));

  const averageAging = Math.round(
    openCases.reduce((sum, entry) => sum + getCaseAgingDays(entry), 0) / Math.max(openCases.length, 1)
  );

  const criticalCases = [...openCases]
    .filter(
      (entry) =>
        getSlaTone(entry.slaDueAt) !== "neutral" ||
        entry.priority === "Critical" ||
        entry.externalStatus === "Pedido a Kingston"
    )
    .sort((left, right) => new Date(left.slaDueAt).getTime() - new Date(right.slaDueAt).getTime())
    .slice(0, 4);

  return {
    headlineMetrics: [
      { label: "Casos abiertos", value: openCases.length, hint: "Operacion activa excluyendo terminales" },
      { label: "SLA comprometido", value: taskBuckets.overdue.length, hint: "Tareas o casos ya vencidos" },
      {
        label: "Pedido a Kingston",
        value: openCases.filter((entry) => entry.externalStatus === "Pedido a Kingston").length,
        hint: "Casos esperando reposicion o arribo"
      },
      {
        label: "Listos para retiro",
        value: openCases.filter((entry) => entry.externalStatus === "Producto listo para retiro").length,
        hint: "Mostrador con entrega pendiente"
      }
    ],
    openCases,
    taskBuckets,
    byZone,
    byStatus,
    ownerLoad,
    averageAging,
    criticalCases
  };
}

export function getCasesIndex(filters?: {
  q?: string;
  status?: string;
  zone?: string;
  owner?: string;
  delivery?: string;
}) {
  const q = filters?.q?.trim().toLowerCase();

  return kingstonCases.filter((entry) => {
    const matchesQuery =
      !q ||
      [
        entry.internalNumber,
        entry.kingstonNumber,
        entry.clientName,
        entry.sku,
        entry.productDescription,
        entry.owner
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);

    const matchesStatus = !filters?.status || entry.externalStatus === filters.status;
    const matchesZone = !filters?.zone || entry.zone === filters.zone;
    const matchesOwner = !filters?.owner || entry.owner === filters.owner;
    const matchesDelivery =
      !filters?.delivery || entry.deliveryMode === (filters.delivery as DeliveryMode);

    return matchesQuery && matchesStatus && matchesZone && matchesOwner && matchesDelivery;
  });
}

export function getSearchParamValue(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function getStatusTone(status: ExternalStatus) {
  if (status === "Pedido a Kingston" || status === "Vencido") return "danger";
  if (
    status === "Producto enviado" ||
    status === "Producto listo para retiro" ||
    status === "Pedido etiqueta" ||
    status === "Pedido deposito"
  ) {
    return "accent";
  }

  if (status === "Realizado") return "success";

  return "neutral";
}

export function getReportsSnapshot() {
  const byClient = Array.from(
    kingstonCases.reduce((map, entry) => {
      map.set(entry.clientName, (map.get(entry.clientName) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  )
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value);

  const bySku = Array.from(
    kingstonCases.reduce((map, entry) => {
      map.set(entry.sku, (map.get(entry.sku) ?? 0) + entry.quantity);
      return map;
    }, new Map<string, number>())
  )
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value);

  const terminalCases = kingstonCases.filter((entry) => isTerminalStatus(entry.externalStatus));
  const completedCases = kingstonCases.filter((entry) => entry.externalStatus === "Realizado");
  const expiredCases = kingstonCases.filter((entry) => entry.externalStatus === "Vencido");

  return {
    throughput: [
      { label: "Realizados", value: completedCases.length, hint: "Casos finalizados con entrega confirmada" },
      { label: "Vencidos", value: expiredCases.length, hint: "Casos caidos por falta de respuesta" },
      { label: "Terminales", value: terminalCases.length, hint: "Cerrados, realizados o vencidos" },
      {
        label: "Aging promedio",
        value: getDashboardSnapshot().averageAging,
        hint: "Dias promedio dentro de la bandeja operativa"
      }
    ],
    byClient,
    bySku
  };
}
