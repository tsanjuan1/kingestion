"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { CaseTable } from "@/components/workspace/case-table";
import { CollapsiblePanel } from "@/components/workspace/collapsible-panel";
import { MetricCard } from "@/components/workspace/metric-card";
import { SectionPanel } from "@/components/workspace/section-panel";
import { TaskList } from "@/components/workspace/task-list";
import { useKingestion } from "@/components/workspace/kingestion-provider";
import { workflowStates } from "@/lib/kingston/data";
import {
  formatCount,
  formatDateTime,
  getAuditActionLabel,
  getCasesIndex,
  getSearchParamValue,
  getSlaLabel,
  getTeamLabel,
  isClosedCaseStatus
} from "@/lib/kingston/helpers";

export function DashboardModule() {
  const searchParams = useSearchParams();
  const { dashboardSnapshot, auditLog, activeOwners, openCases, closedCases, updateCaseStatus } = useKingestion();
  const urgentTasks = [...dashboardSnapshot.taskBuckets.overdue, ...dashboardSnapshot.taskBuckets.dueSoon].slice(0, 4);
  const recentActivity = auditLog.slice(0, 6);
  const openCasesCount = Math.max(dashboardSnapshot.openCases.length, 1);
  const allCases = [...openCases, ...closedCases];
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

  return (
    <div className="workspace-page">
      <CollapsiblePanel
        kicker="Situacion operativa"
        title="Vista rapida de la operacion"
        description="Un pantallazo corto para detectar prioridades y pasar al modulo correcto sin ruido visual."
        defaultOpen
        aside={
          <div className="workspace-inline-actions">
            <Link className="workspace-button-secondary" href="/cases">
              Ver abiertos
            </Link>
            <Link className="workspace-button" href="/cases/new">
              Nuevo caso
            </Link>
          </div>
        }
      >
        <div className="space-y-4">
          <section className="workspace-grid-4">
            {dashboardSnapshot.headlineMetrics.map((metric) => (
              <MetricCard
                key={metric.label}
                label={metric.label}
                value={formatCount(metric.value)}
                hint={metric.hint}
              />
            ))}
          </section>

          <div className="workspace-grid-2">
            <SectionPanel
              title="Casos que requieren atencion"
              description="Prioridad por SLA, criticidad o dependencia con Kingston."
            >
              <div className="space-y-3">
                {dashboardSnapshot.criticalCases.map((entry) => (
                  <Link key={entry.id} href={`/cases/${entry.id}`} className="workspace-list-card">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-white">{entry.internalNumber}</div>
                        <div className="mt-1 text-sm text-white/58">{entry.clientName}</div>
                      </div>
                      <div className="text-right text-sm text-white/68">
                        <div>{entry.externalStatus}</div>
                        <div className="mt-1 text-white/40">{getSlaLabel(entry.slaDueAt)}</div>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-white/70">{entry.nextAction}</p>
                  </Link>
                ))}
              </div>
            </SectionPanel>

            <SectionPanel
              title="Tareas inmediatas"
              description="Vencidas o por vencer para resolver antes de que escalen."
            >
              <TaskList tasks={urgentTasks} emptyLabel="No hay tareas inmediatas en este momento." />
            </SectionPanel>
          </div>
        </div>
      </CollapsiblePanel>

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

      <CollapsiblePanel
        kicker="Seguimiento"
        title="Carga y actividad"
        description="Bloques internos para revisar distribucion del trabajo y ultimas interacciones."
      >
        <div className="workspace-grid-2">
          <SectionPanel title="Carga por responsable" description="Distribucion simple para detectar saturacion o reasignar rapido.">
            <div className="space-y-4">
              {dashboardSnapshot.ownerLoad.map((entry) => (
                <article key={entry.owner}>
                  <div className="flex items-center justify-between text-sm text-white/68">
                    <span>
                      {entry.owner} / {getTeamLabel(entry.team)}
                    </span>
                    <span>{formatCount(entry.count)}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-white/6">
                    <div
                      className="h-2 rounded-full bg-[linear-gradient(90deg,#38bdf8_0%,#22c55e_100%)]"
                      style={{ width: `${(entry.count / openCasesCount) * 100}%` }}
                    />
                  </div>
                </article>
              ))}
            </div>
          </SectionPanel>

          <SectionPanel title="Actividad reciente" description="Ultimas interacciones registradas por usuario y horario.">
            {recentActivity.length === 0 ? (
              <div className="workspace-empty">Todavia no hay movimientos registrados desde esta version interactiva.</div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((entry) => (
                  <article key={entry.id} className="workspace-list-card">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">{getAuditActionLabel(entry.action)}</div>
                      <div className="text-xs uppercase tracking-[0.14em] text-white/40">
                        {formatDateTime(entry.createdAt)}
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-white/68">{entry.detail}</p>
                    <div className="mt-2 text-xs uppercase tracking-[0.14em] text-white/40">{entry.actorName}</div>
                  </article>
                ))}
              </div>
            )}
          </SectionPanel>
        </div>
      </CollapsiblePanel>
    </div>
  );
}
