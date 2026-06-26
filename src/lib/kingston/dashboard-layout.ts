export const dashboardWidgetIds = [
  "metric-open-cases",
  "metric-reimbursements",
  "metric-purchases",
  "metric-service",
  "metric-kingston",
  "metric-overdue",
  "metric-aging",
  "metric-closed",
  "queue-work",
  "operation-risks",
  "status-distribution",
  "zone-distribution",
  "priority-cases",
  "owner-load",
  "automation-health",
  "latest-cases",
  "case-search"
] as const;

export type DashboardWidgetId = (typeof dashboardWidgetIds)[number];

export type DashboardLayoutPreference = {
  order: DashboardWidgetId[];
  hidden: DashboardWidgetId[];
};

export const dashboardWidgetLabels: Record<DashboardWidgetId, string> = {
  "metric-open-cases": "Casos abiertos",
  "metric-reimbursements": "Reintegros",
  "metric-purchases": "Compras",
  "metric-service": "Servicio tecnico",
  "metric-kingston": "Pedido Kingston",
  "metric-overdue": "Tareas vencidas",
  "metric-aging": "Aging promedio",
  "metric-closed": "Cerrados",
  "queue-work": "Bandejas de trabajo",
  "operation-risks": "Riesgos de operacion",
  "status-distribution": "Estados actuales",
  "zone-distribution": "Zonas",
  "priority-cases": "Casos que mirar primero",
  "owner-load": "Carga por responsable",
  "automation-health": "Automatizacion",
  "latest-cases": "Ultimos casos actualizados",
  "case-search": "Busqueda de casos"
};

export function isDashboardWidgetId(value: unknown): value is DashboardWidgetId {
  return typeof value === "string" && dashboardWidgetIds.includes(value as DashboardWidgetId);
}

export function getDefaultDashboardLayoutPreference(): DashboardLayoutPreference {
  return {
    order: [...dashboardWidgetIds],
    hidden: []
  };
}

export function normalizeDashboardLayoutPreference(value: unknown): DashboardLayoutPreference {
  const defaultLayout = getDefaultDashboardLayoutPreference();
  const rawLayout = value && typeof value === "object" ? value : {};
  const rawOrder = "order" in rawLayout && Array.isArray(rawLayout.order) ? rawLayout.order : defaultLayout.order;
  const rawHidden = "hidden" in rawLayout && Array.isArray(rawLayout.hidden) ? rawLayout.hidden : defaultLayout.hidden;
  const order = Array.from(new Set(rawOrder.filter(isDashboardWidgetId)));
  const hidden = Array.from(new Set(rawHidden.filter(isDashboardWidgetId)));
  const missingWidgets = dashboardWidgetIds.filter((widgetId) => !order.includes(widgetId));

  return {
    order: [...order, ...missingWidgets],
    hidden
  };
}
