"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { CaseTable } from "@/components/workspace/case-table";
import { CollapsiblePanel } from "@/components/workspace/collapsible-panel";
import { SectionPanel } from "@/components/workspace/section-panel";
import { useKingestion } from "@/components/workspace/kingestion-provider";
import {
  dashboardWidgetLabels,
  getDefaultDashboardLayoutPreference,
  normalizeDashboardLayoutPreference,
  type DashboardLayoutPreference,
  type DashboardWidgetId
} from "@/lib/kingston/dashboard-layout";
import { workflowStates } from "@/lib/kingston/data";
import type { AutomationCloudStatus } from "@/lib/kingston/contracts";
import type { KingstonCase } from "@/lib/kingston/types";
import {
  formatCount,
  formatDate,
  formatDateTime,
  getCasesIndex,
  getPendingPurchasesCases,
  getPendingReimbursements,
  getPendingTechnicalCases,
  getSearchParamValue,
  getSlaLabel,
  getTeamLabel,
  isClosedCaseStatus
} from "@/lib/kingston/helpers";

type AutomationEmailHistoryItem = {
  id: string;
  subject: string;
  status: "pending" | "sending" | "sent" | "error" | "failed";
  source: string;
  to: string[];
  sentAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type DashboardMetricProps = {
  label: string;
  value: number | string;
  hint: string;
  href?: string;
  tone?: "blue" | "green" | "amber" | "red" | "neutral";
};

type DashboardWidgetSize = "small" | "large" | "full";

const dashboardWidgetSizes: Record<DashboardWidgetId, DashboardWidgetSize> = {
  "metric-open-cases": "small",
  "metric-reimbursements": "small",
  "metric-purchases": "small",
  "metric-service": "small",
  "metric-kingston": "small",
  "metric-overdue": "small",
  "metric-aging": "small",
  "metric-closed": "small",
  "queue-work": "large",
  "operation-risks": "large",
  "status-distribution": "large",
  "zone-distribution": "large",
  "priority-cases": "large",
  "owner-load": "large",
  "automation-health": "large",
  "latest-cases": "large",
  "case-search": "full"
};

async function parseApiMessage(response: Response) {
  try {
    const payload = (await response.json()) as { message?: string };
    return payload.message ?? "No pude cargar la informacion.";
  } catch {
    return "No pude cargar la informacion.";
  }
}

function getAutomationStatusLabel(status: AutomationCloudStatus | null, isLoading: boolean) {
  if (isLoading && !status) return "Verificando";
  if (!status) return "Sin datos";
  if (status.control.paused) return "Pausada";
  if (!status.manualTriggerConfigured) return "Revisar correo";
  return "Activa";
}

function getAutomationStatusTone(status: AutomationCloudStatus | null, isLoading: boolean) {
  if (isLoading && !status) return "workspace-health-status-warning";
  if (!status) return "workspace-health-status-danger";
  if (status.control.paused) return "workspace-health-status-danger";
  if (!status.manualTriggerConfigured) return "workspace-health-status-warning";
  return "workspace-health-status-success";
}

function getEmailStatusLabel(status: AutomationEmailHistoryItem["status"]) {
  switch (status) {
    case "sent":
      return "Enviado";
    case "pending":
      return "Pendiente";
    case "sending":
      return "En envio";
    case "failed":
      return "Fallido";
    case "error":
      return "Con error";
    default:
      return status;
  }
}

function formatOptionalDateTime(value: string | null | undefined) {
  return value ? formatDateTime(value) : "Sin registro";
}

function DashboardMetric({ label, value, hint, href, tone = "neutral" }: DashboardMetricProps) {
  const content = (
    <>
      <span className="workspace-summary-metric-label">{label}</span>
      <strong>{typeof value === "number" ? formatCount(value) : value}</strong>
      <small>{hint}</small>
    </>
  );

  const className = `workspace-summary-metric workspace-summary-metric-${tone}`;

  return href ? (
    <Link className={className} href={href}>
      {content}
    </Link>
  ) : (
    <article className={className}>{content}</article>
  );
}

function QueueCard({
  label,
  value,
  hint,
  href
}: {
  label: string;
  value: number;
  hint: string;
  href?: string;
}) {
  const content = (
    <>
      <span>{label}</span>
      <strong>{formatCount(value)}</strong>
      <small>{hint}</small>
    </>
  );

  return href ? (
    <Link className="workspace-summary-queue-card" href={href}>
      {content}
    </Link>
  ) : (
    <article className="workspace-summary-queue-card">{content}</article>
  );
}

function ProgressRow({
  label,
  value,
  max,
  href
}: {
  label: string;
  value: number;
  max: number;
  href?: string;
}) {
  const width = Math.max(4, Math.round((value / Math.max(max, 1)) * 100));
  const content = (
    <>
      <div className="workspace-summary-bar-row-head">
        <span>{label}</span>
        <strong>{formatCount(value)}</strong>
      </div>
      <div className="workspace-summary-bar-track">
        <div className="workspace-summary-bar-fill" style={{ width: `${width}%` }} />
      </div>
    </>
  );

  return href ? (
    <Link className="workspace-summary-bar-row workspace-summary-bar-row-link" href={href}>
      {content}
    </Link>
  ) : (
    <div className="workspace-summary-bar-row">{content}</div>
  );
}

function CaseSummaryCard({ entry, href, detail }: { entry: KingstonCase; href?: string; detail?: string }) {
  const content = (
    <>
      <div>
        <strong>{entry.internalNumber}</strong>
        <span>{entry.clientName}</span>
      </div>
      <div>
        <small>{entry.externalStatus}</small>
        <small>{detail ?? getSlaLabel(entry.slaDueAt)}</small>
      </div>
    </>
  );

  return href ? (
    <Link className="workspace-summary-case-card" href={href}>
      {content}
    </Link>
  ) : (
    <article className="workspace-summary-case-card">{content}</article>
  );
}

function CasePriorityList({ cases, canOpenCases }: { cases: KingstonCase[]; canOpenCases: boolean }) {
  if (cases.length === 0) {
    return <div className="workspace-empty">No hay casos criticos para destacar en este momento.</div>;
  }

  return (
    <div className="workspace-summary-list">
      {cases.map((entry) => (
        <CaseSummaryCard key={entry.id} entry={entry} href={canOpenCases ? `/cases/${entry.id}` : undefined} />
      ))}
    </div>
  );
}

export function DashboardModule() {
  const searchParams = useSearchParams();
  const {
    cases,
    dashboardSnapshot,
    activeOwners,
    openCases,
    closedCases,
    currentUser,
    updateCaseStatus,
    canAccessModule,
    canManageModule
  } = useKingestion();
  const allCases = [...openCases, ...closedCases];
  const pendingReimbursements = getPendingReimbursements(cases);
  const pendingPurchases = getPendingPurchasesCases(cases);
  const pendingTechnical = getPendingTechnicalCases(cases);
  const maxStatusCount = Math.max(...dashboardSnapshot.byStatus.map((entry) => entry.count), 1);
  const maxZoneCount = Math.max(...dashboardSnapshot.byZone.map((entry) => entry.value), 1);
  const maxOwnerLoad = Math.max(...dashboardSnapshot.ownerLoad.map((entry) => entry.count), 1);
  const pedidoKingstonCount = openCases.filter((entry) => entry.externalStatus === "Pedido Kingston").length;
  const unassignedCount = openCases.filter((entry) => entry.owner === "Sin asignar").length;
  const guidePendingCount = openCases.filter((entry) => entry.externalStatus === "Pedido guia").length;
  const soonTasksCount = dashboardSnapshot.taskBuckets.dueSoon.length;
  const latestCases = [...openCases]
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, 5);
  const [automationStatus, setAutomationStatus] = useState<AutomationCloudStatus | null>(null);
  const [automationEmails, setAutomationEmails] = useState<AutomationEmailHistoryItem[]>([]);
  const [automationHealthError, setAutomationHealthError] = useState<string | null>(null);
  const [automationEmailError, setAutomationEmailError] = useState<string | null>(null);
  const [isLoadingAutomationHealth, setIsLoadingAutomationHealth] = useState(false);
  const [dashboardLayout, setDashboardLayout] = useState<DashboardLayoutPreference>(() =>
    getDefaultDashboardLayoutPreference()
  );
  const [isCustomizingDashboard, setIsCustomizingDashboard] = useState(false);
  const [dashboardLayoutStatus, setDashboardLayoutStatus] = useState("");
  const [draggedWidgetId, setDraggedWidgetId] = useState<DashboardWidgetId | null>(null);
  const canReadMail = canAccessModule("mail");
  const canReadAudit = canAccessModule("audit");
  const canReadOpenCases = canAccessModule("open-cases");
  const canReadAutomationEmails = canReadMail || canReadAudit;
  const filters = {
    q: getSearchParamValue(searchParams.get("q") ?? undefined) ?? "",
    status: getSearchParamValue(searchParams.get("status") ?? undefined) ?? "",
    owner: getSearchParamValue(searchParams.get("owner") ?? undefined) ?? "",
    delivery: getSearchParamValue(searchParams.get("delivery") ?? undefined) ?? "",
    zone: getSearchParamValue(searchParams.get("zone") ?? undefined) ?? "",
    lifecycle: getSearchParamValue(searchParams.get("lifecycle") ?? undefined) ?? ""
  };
  const hasSearchFilters = Object.values(filters).some((value) => value.trim().length > 0);
  const searchResults = getCasesIndex(filters, allCases)
    .filter((entry) => {
      if (filters.lifecycle === "open") return !isClosedCaseStatus(entry.externalStatus);
      if (filters.lifecycle === "closed") return isClosedCaseStatus(entry.externalStatus);
      return true;
    })
    .toSorted((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  const automationEmailStats = useMemo(() => {
    return automationEmails.reduce(
      (stats, email) => {
        if (email.status === "sent") stats.sent += 1;
        if (email.status === "pending" || email.status === "sending") stats.pending += 1;
        if (email.status === "error" || email.status === "failed") stats.failed += 1;
        return stats;
      },
      { sent: 0, pending: 0, failed: 0 }
    );
  }, [automationEmails]);
  const recentAutomationEmails = automationEmails.slice(0, 3);
  const hiddenWidgetSet = new Set(dashboardLayout.hidden);
  const visibleWidgetIds = dashboardLayout.order.filter((widgetId) => !hiddenWidgetSet.has(widgetId));
  const hiddenWidgetIds = dashboardLayout.order.filter((widgetId) => hiddenWidgetSet.has(widgetId));

  useEffect(() => {
    let cancelled = false;

    async function loadDashboardLayout() {
      try {
        const response = await fetch("/api/profile/dashboard-layout", {
          credentials: "include",
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error(await parseApiMessage(response));
        }

        const payload = (await response.json()) as { layout?: unknown };
        if (!cancelled) {
          setDashboardLayout(normalizeDashboardLayoutPreference(payload.layout));
        }
      } catch {
        if (!cancelled) {
          setDashboardLayout(getDefaultDashboardLayoutPreference());
        }
      }
    }

    void loadDashboardLayout();

    return () => {
      cancelled = true;
    };
  }, [currentUser.id]);

  function persistDashboardLayout(nextLayout: DashboardLayoutPreference) {
    const normalizedLayout = normalizeDashboardLayoutPreference(nextLayout);
    setDashboardLayout(normalizedLayout);
    setDashboardLayoutStatus("Guardando personalizacion...");

    void (async () => {
      try {
        const response = await fetch("/api/profile/dashboard-layout", {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(normalizedLayout)
        });

        if (!response.ok) {
          throw new Error(await parseApiMessage(response));
        }

        const payload = (await response.json()) as { layout?: unknown };
        setDashboardLayout(normalizeDashboardLayoutPreference(payload.layout));
        setDashboardLayoutStatus("Personalizacion guardada");
      } catch (error) {
        setDashboardLayoutStatus(error instanceof Error ? error.message : "No pude guardar la personalizacion.");
      }
    })();
  }

  function hideDashboardWidget(widgetId: DashboardWidgetId) {
    persistDashboardLayout({
      order: dashboardLayout.order,
      hidden: Array.from(new Set([...dashboardLayout.hidden, widgetId]))
    });
  }

  function showDashboardWidget(widgetId: DashboardWidgetId) {
    persistDashboardLayout({
      order: dashboardLayout.order,
      hidden: dashboardLayout.hidden.filter((hiddenWidgetId) => hiddenWidgetId !== widgetId)
    });
  }

  function moveDashboardWidget(widgetId: DashboardWidgetId, direction: "up" | "down") {
    const visibleOrder = dashboardLayout.order.filter((entry) => !dashboardLayout.hidden.includes(entry));
    const currentIndex = visibleOrder.indexOf(widgetId);
    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= visibleOrder.length) {
      return;
    }

    const nextVisibleOrder = [...visibleOrder];
    const [movedWidget] = nextVisibleOrder.splice(currentIndex, 1);
    if (!movedWidget) {
      return;
    }
    nextVisibleOrder.splice(nextIndex, 0, movedWidget);
    const hiddenOrder = dashboardLayout.order.filter((entry) => dashboardLayout.hidden.includes(entry));

    persistDashboardLayout({
      order: [...nextVisibleOrder, ...hiddenOrder],
      hidden: dashboardLayout.hidden
    });
  }

  function dropDashboardWidget(targetWidgetId: DashboardWidgetId) {
    if (!draggedWidgetId || draggedWidgetId === targetWidgetId) {
      setDraggedWidgetId(null);
      return;
    }

    const nextOrder = dashboardLayout.order.filter((widgetId) => widgetId !== draggedWidgetId);
    const targetIndex = nextOrder.indexOf(targetWidgetId);
    nextOrder.splice(Math.max(targetIndex, 0), 0, draggedWidgetId);

    persistDashboardLayout({
      order: nextOrder,
      hidden: dashboardLayout.hidden
    });
    setDraggedWidgetId(null);
  }

  function resetDashboardLayout() {
    persistDashboardLayout(getDefaultDashboardLayoutPreference());
  }

  useEffect(() => {
    let cancelled = false;

    async function loadAutomationHealth() {
      setIsLoadingAutomationHealth(true);
      setAutomationHealthError(null);
      setAutomationEmailError(null);

      try {
        const statusResponse = await fetch("/api/automation/control/kingston-rma", {
          credentials: "include",
          cache: "no-store"
        });

        if (!statusResponse.ok) {
          throw new Error(await parseApiMessage(statusResponse));
        }

        const nextStatus = (await statusResponse.json()) as AutomationCloudStatus;
        if (!cancelled) {
          setAutomationStatus(nextStatus);
        }
      } catch (error) {
        if (!cancelled) {
          setAutomationHealthError(error instanceof Error ? error.message : "No pude cargar la salud de automatizaciones.");
          setAutomationStatus(null);
        }
      }

      if (!canReadAutomationEmails) {
        if (!cancelled) {
          setAutomationEmails([]);
          setIsLoadingAutomationHealth(false);
        }
        return;
      }

      try {
        const emailsResponse = await fetch("/api/automation/emails?limit=80", {
          credentials: "include",
          cache: "no-store"
        });

        if (!emailsResponse.ok) {
          throw new Error(await parseApiMessage(emailsResponse));
        }

        const payload = (await emailsResponse.json()) as { items?: AutomationEmailHistoryItem[] };
        if (!cancelled) {
          setAutomationEmails(payload.items ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          setAutomationEmails([]);
          setAutomationEmailError(error instanceof Error ? error.message : "No pude cargar el historial de correos.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingAutomationHealth(false);
        }
      }
    }

    void loadAutomationHealth();

    return () => {
      cancelled = true;
    };
  }, [canReadAutomationEmails]);

  const dashboardWidgets: Record<DashboardWidgetId, ReactNode> = {
    "metric-open-cases": (
      <DashboardMetric
        label="Casos abiertos"
        value={openCases.length}
        hint="Operaciones activas"
        href={canReadOpenCases ? "/cases" : undefined}
        tone="blue"
      />
    ),
    "metric-reimbursements": (
      <DashboardMetric
        label="Reintegros"
        value={pendingReimbursements.length}
        hint="Pendientes de seguimiento"
        href={canAccessModule("reimbursements") ? "/reimbursements" : undefined}
        tone={pendingReimbursements.length > 0 ? "amber" : "green"}
      />
    ),
    "metric-purchases": (
      <DashboardMetric
        label="Compras"
        value={pendingPurchases.length}
        hint="Casos pendientes de compras"
        href={canAccessModule("pending-purchases") ? "/pending-purchases" : undefined}
        tone={pendingPurchases.length > 0 ? "amber" : "green"}
      />
    ),
    "metric-service": (
      <DashboardMetric
        label="Servicio tecnico"
        value={pendingTechnical.length}
        hint="Casos pendientes del sector"
        href={canAccessModule("pending-service") ? "/pending-service" : undefined}
        tone={pendingTechnical.length > 0 ? "amber" : "green"}
      />
    ),
    "metric-kingston": (
      <DashboardMetric
        label="Pedido Kingston"
        value={pedidoKingstonCount}
        hint="Reposicion o arribo externo"
        href={canReadOpenCases ? "/cases" : undefined}
        tone={pedidoKingstonCount > 0 ? "red" : "neutral"}
      />
    ),
    "metric-overdue": (
      <DashboardMetric
        label="Tareas vencidas"
        value={dashboardSnapshot.taskBuckets.overdue.length}
        hint="Necesitan revision"
        tone={dashboardSnapshot.taskBuckets.overdue.length > 0 ? "red" : "green"}
      />
    ),
    "metric-aging": (
      <DashboardMetric
        label="Aging promedio"
        value={`${dashboardSnapshot.averageAging}d`}
        hint="Promedio sobre casos abiertos"
        tone="neutral"
      />
    ),
    "metric-closed": (
      <DashboardMetric
        label="Cerrados"
        value={closedCases.length}
        hint="Realizados, vencidos o cerrados"
        href={canAccessModule("closed-cases") ? "/closed-cases" : undefined}
        tone="green"
      />
    ),
    "queue-work": (
      <SectionPanel title="Bandejas de trabajo" description="Pendientes vivos por sector sin sacar los casos de su modulo principal.">
        <div className="workspace-summary-queue-grid">
          <QueueCard
            label="Reintegros"
            value={pendingReimbursements.length}
            hint={`${pendingReimbursements.filter((entry) => entry.logistics.reimbursementState === "In process").length} en proceso`}
            href={canAccessModule("reimbursements") ? "/reimbursements" : undefined}
          />
          <QueueCard
            label="Compras"
            value={pendingPurchases.length}
            hint={`${pedidoKingstonCount} en Pedido Kingston`}
            href={canAccessModule("pending-purchases") ? "/pending-purchases" : undefined}
          />
          <QueueCard
            label="Servicio tecnico"
            value={pendingTechnical.length}
            hint={`${guidePendingCount} con guia pendiente`}
            href={canAccessModule("pending-service") ? "/pending-service" : undefined}
          />
        </div>
      </SectionPanel>
    ),
    "operation-risks": (
      <SectionPanel title="Riesgos de operacion" description="Señales para mirar primero antes de entrar caso por caso.">
        <div className="workspace-summary-alert-list">
          <div className={dashboardSnapshot.taskBuckets.overdue.length > 0 ? "workspace-summary-alert-danger" : ""}>
            <strong>{formatCount(dashboardSnapshot.taskBuckets.overdue.length)}</strong>
            <span>Tareas vencidas</span>
          </div>
          <div className={soonTasksCount > 0 ? "workspace-summary-alert-warning" : ""}>
            <strong>{formatCount(soonTasksCount)}</strong>
            <span>Tareas por vencer</span>
          </div>
          <div className={unassignedCount > 0 ? "workspace-summary-alert-warning" : ""}>
            <strong>{formatCount(unassignedCount)}</strong>
            <span>Casos sin responsable</span>
          </div>
          <div className={dashboardSnapshot.criticalCases.length > 0 ? "workspace-summary-alert-danger" : ""}>
            <strong>{formatCount(dashboardSnapshot.criticalCases.length)}</strong>
            <span>Casos criticos/SLA</span>
          </div>
        </div>
      </SectionPanel>
    ),
    "status-distribution": (
      <SectionPanel title="Estados actuales" description="Distribucion de casos abiertos por etapa del workflow.">
        {dashboardSnapshot.byStatus.length === 0 ? (
          <div className="workspace-empty">No hay casos abiertos para graficar por estado.</div>
        ) : (
          <div className="workspace-summary-bar-list">
            {dashboardSnapshot.byStatus.map((entry) => (
              <ProgressRow
                key={entry.status}
                label={entry.status}
                value={entry.count}
                max={maxStatusCount}
                href={canReadOpenCases ? "/cases" : undefined}
              />
            ))}
          </div>
        )}
      </SectionPanel>
    ),
    "zone-distribution": (
      <SectionPanel title="Zonas" description="Lectura rapida de donde esta concentrada la operacion.">
        {dashboardSnapshot.byZone.length === 0 ? (
          <div className="workspace-empty">No hay casos abiertos para graficar por zona.</div>
        ) : (
          <div className="workspace-summary-bar-list">
            {dashboardSnapshot.byZone.map((entry) => (
              <ProgressRow
                key={entry.label}
                label={entry.label}
                value={entry.value}
                max={maxZoneCount}
                href={canReadOpenCases ? "/cases" : undefined}
              />
            ))}
          </div>
        )}
      </SectionPanel>
    ),
    "priority-cases": (
      <SectionPanel title="Casos que mirar primero" description="Priorizados por SLA, criticidad o dependencia con Kingston.">
        <CasePriorityList cases={dashboardSnapshot.criticalCases} canOpenCases={canReadOpenCases} />
      </SectionPanel>
    ),
    "owner-load": (
      <SectionPanel title="Carga por responsable" description="Distribucion actual de casos abiertos por responsable.">
        {dashboardSnapshot.ownerLoad.length === 0 ? (
          <div className="workspace-empty">No hay responsables con carga operativa.</div>
        ) : (
          <div className="workspace-summary-bar-list">
            {dashboardSnapshot.ownerLoad.map((entry) => (
              <ProgressRow
                key={entry.owner}
                label={`${entry.owner} / ${getTeamLabel(entry.team)}`}
                value={entry.count}
                max={maxOwnerLoad}
              />
            ))}
          </div>
        )}
      </SectionPanel>
    ),
    "automation-health": (
      <SectionPanel title="Automatizacion" description="Estado informativo del circuito de correos, IA y avisos automaticos.">
        <div className="workspace-summary-automation-head">
          <span className={`workspace-health-status ${getAutomationStatusTone(automationStatus, isLoadingAutomationHealth)}`}>
            {getAutomationStatusLabel(automationStatus, isLoadingAutomationHealth)}
          </span>
          <span>{isLoadingAutomationHealth ? "Actualizando lectura..." : "Lectura en vivo"}</span>
        </div>

        {automationHealthError ? <div className="workspace-empty">{automationHealthError}</div> : null}

        <div className="workspace-summary-automation-grid">
          <div>
            <span>Ultima lectura</span>
            <strong>{formatOptionalDateTime(automationStatus?.lastRunAt)}</strong>
          </div>
          <div>
            <span>Correos deduplicados</span>
            <strong>{formatCount(automationStatus?.processedMailCount ?? 0)}</strong>
          </div>
          <div>
            <span>Correo conectado</span>
            <strong>{automationStatus?.manualTriggerConfigured ? "Si" : "Revisar"}</strong>
          </div>
          <div>
            <span>IA comprobantes</span>
            <strong>{automationStatus?.proofAttachmentAiEnabled ? "Activa" : "Inactiva"}</strong>
          </div>
        </div>

        <div className="workspace-health-email-summary">
          <span>Enviados: {formatCount(automationEmailStats.sent)}</span>
          <span>Pendientes: {formatCount(automationEmailStats.pending)}</span>
          <span>Con error: {formatCount(automationEmailStats.failed)}</span>
        </div>

        {automationEmailError ? <div className="workspace-empty">{automationEmailError}</div> : null}
        {recentAutomationEmails.length > 0 ? (
          <div className="workspace-summary-list">
            {recentAutomationEmails.map((email) => (
              <article key={email.id} className="workspace-summary-email-row">
                <strong>{email.subject}</strong>
                <span>
                  {getEmailStatusLabel(email.status)} / {formatOptionalDateTime(email.sentAt ?? email.updatedAt ?? email.createdAt)}
                </span>
              </article>
            ))}
          </div>
        ) : null}
      </SectionPanel>
    ),
    "latest-cases": (
      <SectionPanel title="Ultimos casos actualizados" description="Movimiento reciente dentro de la bandeja activa.">
        {latestCases.length === 0 ? (
          <div className="workspace-empty">Todavia no hay casos abiertos para mostrar.</div>
        ) : (
          <div className="workspace-summary-list">
            {latestCases.map((entry) => (
              <CaseSummaryCard
                key={entry.id}
                entry={entry}
                href={canReadOpenCases ? `/cases/${entry.id}` : undefined}
                detail={`Actualizado ${formatDate(entry.updatedAt)}`}
              />
            ))}
          </div>
        )}
      </SectionPanel>
    ),
    "case-search": (
      <CollapsiblePanel
        kicker="Busqueda"
        title="Busqueda de casos"
        description="Filtros avanzados para encontrar abiertos o cerrados sin mezclar la vista operativa."
        defaultOpen={hasSearchFilters}
      >
        <div className="space-y-4">
          <form action="/dashboard" className="workspace-inline-form">
            <div className="workspace-form-grid">
              <label className="workspace-label">
                <span>Buscar</span>
                <input
                  className="workspace-input"
                  name="q"
                  defaultValue={filters.q}
                  placeholder="Numero, ticket Kingston, cliente, SKU o direccion"
                />
              </label>

              <label className="workspace-label">
                <span>Vista</span>
                <select className="workspace-select" name="lifecycle" defaultValue={filters.lifecycle}>
                  <option value="">Todos</option>
                  <option value="open">Solo abiertos</option>
                  <option value="closed">Solo cerrados</option>
                </select>
              </label>

              <label className="workspace-label">
                <span>Estado</span>
                <select className="workspace-select" name="status" defaultValue={filters.status}>
                  <option value="">Todos</option>
                  {workflowStates.map((state) => (
                    <option key={state.status} value={state.status}>
                      {state.status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="workspace-label">
                <span>Zona</span>
                <select className="workspace-select" name="zone" defaultValue={filters.zone}>
                  <option value="">Todas</option>
                  <option value="Interior / Gran Buenos Aires">Interior / Gran Buenos Aires</option>
                  <option value="Capital / AMBA">Capital / AMBA</option>
                </select>
              </label>

              <label className="workspace-label">
                <span>Responsable</span>
                <select className="workspace-select" name="owner" defaultValue={filters.owner}>
                  <option value="">Todos</option>
                  {activeOwners.map((owner) => (
                    <option key={owner.id} value={owner.name}>
                      {owner.name}
                    </option>
                  ))}
                  <option value="Sin asignar">Sin asignar</option>
                </select>
              </label>

              <label className="workspace-label">
                <span>Modalidad</span>
                <select className="workspace-select" name="delivery" defaultValue={filters.delivery}>
                  <option value="">Todas</option>
                  <option value="Dispatch">Envio</option>
                  <option value="Pickup">Retiro</option>
                </select>
              </label>
            </div>

            <div className="workspace-inline-actions">
              <button className="workspace-button" type="submit">
                Buscar
              </button>
              <Link className="workspace-button-secondary" href="/dashboard">
                Limpiar
              </Link>
            </div>
          </form>

          {hasSearchFilters ? (
            <SectionPanel
              title="Resultados"
              description={`${searchResults.length} casos encontrados para la combinacion actual.`}
            >
              <CaseTable
                cases={searchResults}
                onStatusChange={updateCaseStatus}
                disableStatusChange={!canManageModule("open-cases")}
                emptyLabel="No hay coincidencias con los filtros actuales."
              />
            </SectionPanel>
          ) : (
            <div className="workspace-empty">
              Usa este bloque para buscar por numero, cliente, zona, responsable, estado o modalidad.
            </div>
          )}
        </div>
      </CollapsiblePanel>
    )
  };

  function renderDashboardWidget(widgetId: DashboardWidgetId, index: number) {
    const widgetSize = dashboardWidgetSizes[widgetId];

    return (
      <article
        key={widgetId}
        className={`workspace-dashboard-widget workspace-dashboard-widget-${widgetSize}`}
        draggable={isCustomizingDashboard}
        onDragStart={() => setDraggedWidgetId(widgetId)}
        onDragOver={(event) => {
          if (isCustomizingDashboard) {
            event.preventDefault();
          }
        }}
        onDrop={() => dropDashboardWidget(widgetId)}
      >
        {isCustomizingDashboard ? (
          <div className="workspace-dashboard-widget-toolbar">
            <span>{dashboardWidgetLabels[widgetId]}</span>
            <div>
              <button
                type="button"
                onClick={() => moveDashboardWidget(widgetId, "up")}
                disabled={index === 0}
                aria-label={`Subir ${dashboardWidgetLabels[widgetId]}`}
              >
                Subir
              </button>
              <button
                type="button"
                onClick={() => moveDashboardWidget(widgetId, "down")}
                disabled={index === visibleWidgetIds.length - 1}
                aria-label={`Bajar ${dashboardWidgetLabels[widgetId]}`}
              >
                Bajar
              </button>
              <button type="button" onClick={() => hideDashboardWidget(widgetId)}>
                Quitar
              </button>
            </div>
          </div>
        ) : null}
        {dashboardWidgets[widgetId]}
      </article>
    );
  }

  if (!canAccessModule("summary")) {
    return (
      <div className="workspace-page">
        <SectionPanel title="Sin permisos" description="Tu usuario no tiene acceso al modulo Resumen.">
          <div className="workspace-empty">Pedi al administrador que revise tus permisos.</div>
        </SectionPanel>
      </div>
    );
  }

  return (
    <div className="workspace-page workspace-summary-dashboard">
      <section className="workspace-summary-hero">
        <div>
          <p className="workspace-kicker">Resumen</p>
          <h1 className="workspace-title">Dashboard operativo</h1>
          <p className="workspace-subtitle">
            Pantallazo general de casos, pendientes por sector, riesgos, carga de trabajo y automatizaciones de Kingestion.
          </p>
        </div>

        <div className="workspace-summary-hero-actions">
          <button
            className="workspace-button-secondary"
            type="button"
            onClick={() => setIsCustomizingDashboard((current) => !current)}
          >
            {isCustomizingDashboard ? "Cerrar personalizacion" : "Personalizar"}
          </button>
          {canReadOpenCases ? (
            <Link className="workspace-button-secondary" href="/cases">
              Ver abiertos
            </Link>
          ) : null}
          {canReadMail ? (
            <Link className="workspace-button-secondary" href="/mail">
              Correo
            </Link>
          ) : null}
          {canReadOpenCases ? (
            <Link className="workspace-button" href="/cases/new">
              Nuevo caso
            </Link>
          ) : null}
        </div>
      </section>

      {isCustomizingDashboard ? (
        <section className="workspace-dashboard-customizer">
          <div>
            <p className="workspace-kicker">Personalizacion</p>
            <h2>Elegir y ordenar recuadros</h2>
            <p>
              Arrastra los recuadros, usa Subir/Bajar o quita lo que no quieras ver. La preferencia queda guardada en tu usuario.
            </p>
            {dashboardLayoutStatus ? <span>{dashboardLayoutStatus}</span> : null}
          </div>

          <div className="workspace-dashboard-customizer-actions">
            <button className="workspace-button-secondary" type="button" onClick={resetDashboardLayout}>
              Restaurar dashboard
            </button>
            <button className="workspace-button" type="button" onClick={() => setIsCustomizingDashboard(false)}>
              Listo
            </button>
          </div>

          {hiddenWidgetIds.length > 0 ? (
            <div className="workspace-dashboard-hidden-widgets">
              <strong>Recuadros ocultos</strong>
              <div>
                {hiddenWidgetIds.map((widgetId) => (
                  <button key={widgetId} type="button" onClick={() => showDashboardWidget(widgetId)}>
                    Agregar {dashboardWidgetLabels[widgetId]}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {visibleWidgetIds.length > 0 ? (
        <section className="workspace-dashboard-widget-grid">
          {visibleWidgetIds.map((widgetId, index) => renderDashboardWidget(widgetId, index))}
        </section>
      ) : (
        <SectionPanel title="Dashboard vacio" description="No tenes recuadros visibles en este resumen.">
          <div className="workspace-empty">
            Activa Personalizar y agrega al menos un recuadro para volver a ver informacion en tu dashboard.
          </div>
        </SectionPanel>
      )}
    </div>
  );
}
