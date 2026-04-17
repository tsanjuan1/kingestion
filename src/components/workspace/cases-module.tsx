"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { MetricCard } from "@/components/workspace/metric-card";
import { ModuleSubnav } from "@/components/workspace/module-subnav";
import { SectionPanel } from "@/components/workspace/section-panel";
import { useKingestion } from "@/components/workspace/kingestion-provider";
import { WorkflowChecklist } from "@/components/workspace/workflow-checklist";
import { workflowStates } from "@/lib/kingston/data";
import {
  formatCount,
  formatDate,
  getCasesIndex,
  getDeliveryModeLabel,
  getSearchParamValue,
  getStatusTone
} from "@/lib/kingston/helpers";
import type { ExternalStatus } from "@/lib/kingston/types";

type CasesModuleProps = {
  mode: "open" | "closed";
};

function getToneClass(status: ExternalStatus) {
  switch (getStatusTone(status)) {
    case "danger":
      return "text-[#fecdd3]";
    case "success":
      return "text-[#bbf7d0]";
    case "warning":
      return "text-[#fde68a]";
    case "accent":
      return "text-[#bae6fd]";
    default:
      return "text-white";
  }
}

export function CasesModule({ mode }: CasesModuleProps) {
  const searchParams = useSearchParams();
  const { openCases, closedCases, activeOwners, updateCaseStatus } = useKingestion();
  const filters = {
    q: getSearchParamValue(searchParams.get("q") ?? undefined) ?? "",
    status: getSearchParamValue(searchParams.get("status") ?? undefined) ?? "",
    owner: getSearchParamValue(searchParams.get("owner") ?? undefined) ?? "",
    delivery: getSearchParamValue(searchParams.get("delivery") ?? undefined) ?? ""
  };

  const baseCases = mode === "open" ? openCases : closedCases;
  const cases = getCasesIndex(filters, baseCases).sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );

  const isOpenView = mode === "open";
  const currentPath = isOpenView ? "/cases" : "/closed-cases";

  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="workspace-page-header-row">
          <div>
            <p className="workspace-kicker">Casos</p>
            <h1 className="workspace-title">{isOpenView ? "Casos abiertos" : "Casos cerrados"}</h1>
          </div>

          <div className="workspace-chip-row">
            {isOpenView ? (
              <Link className="workspace-button" href="/cases/new">
                Nuevo caso
              </Link>
            ) : null}
            <Link className="workspace-button-secondary" href={isOpenView ? "/closed-cases" : "/cases"}>
              {isOpenView ? "Ver cerrados" : "Ver abiertos"}
            </Link>
          </div>
        </div>
        <p className="workspace-subtitle">
          {isOpenView
            ? "Bandeja operativa con el checklist de etapas para mover cada caso sin entrar al detalle."
            : "Historial de casos finalizados o cerrados administrativamente, separado de la operacion activa."}
        </p>
      </header>

      <ModuleSubnav
        items={[
          { href: "/cases", label: "Casos abiertos", active: isOpenView },
          { href: "/closed-cases", label: "Casos cerrados", active: !isOpenView },
          ...(isOpenView ? [{ href: "/cases/new", label: "Nuevo caso" }] : [])
        ]}
      />

      <section className="workspace-grid-3">
        {isOpenView ? (
          <>
            <MetricCard
              label="Abiertos"
              value={formatCount(openCases.length)}
              hint="Casos operativos, incluyendo vencidos mientras no cierren."
            />
            <MetricCard
              label="Envio o retiro"
              value={formatCount(
                openCases.filter(
                  (entry) =>
                    entry.externalStatus === "Producto enviado" ||
                    entry.externalStatus === "Producto listo para retiro"
                ).length
              )}
              hint="Casos en la ultima milla de la operacion."
            />
            <MetricCard
              label="Pedido a Kingston"
              value={formatCount(openCases.filter((entry) => entry.externalStatus === "Pedido a Kingston").length)}
              hint="Casos que dependen de reposicion o arribo."
            />
          </>
        ) : (
          <>
            <MetricCard
              label="Cerrados"
              value={formatCount(closedCases.length)}
              hint="Total archivado fuera de la bandeja activa."
            />
            <MetricCard
              label="Realizados"
              value={formatCount(closedCases.filter((entry) => entry.externalStatus === "Realizado").length)}
              hint="Casos terminados con entrega confirmada."
            />
            <MetricCard
              label="Cierre admin."
              value={formatCount(closedCases.filter((entry) => entry.externalStatus === "Cerrado").length)}
              hint="Casos archivados por decision operativa o de Kingston."
            />
          </>
        )}
      </section>

      <SectionPanel title="Filtros" description="Filtros cortos para encontrar rapido un caso dentro del modulo actual.">
        <form action={currentPath} className="workspace-inline-form">
          <div className="workspace-form-grid">
            <label className="workspace-label">
              <span>Buscar</span>
              <input
                className="workspace-input"
                name="q"
                defaultValue={filters.q}
                placeholder="Numero, cliente, ticket Kingston o SKU"
              />
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

          <div className="workspace-chip-row">
            <button className="workspace-button" type="submit">
              Aplicar filtros
            </button>
            <Link className="workspace-button-secondary" href={currentPath}>
              Limpiar
            </Link>
          </div>
        </form>
      </SectionPanel>

      <SectionPanel
        title={isOpenView ? "Bandeja operativa" : "Archivo operativo"}
        description="Numero de caso, ingreso, cliente, SKU y avance del estado en linea."
      >
        {cases.length === 0 ? (
          <div className="workspace-empty">No hay casos para los filtros seleccionados.</div>
        ) : (
          <div className="workspace-table-wrap">
            <table className="workspace-table workspace-cases-table">
              <thead>
                <tr>
                  <th>Numero de caso</th>
                  <th>Ingreso</th>
                  <th>Cliente</th>
                  <th>SKU fallado</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <Link className="workspace-case-link" href={`/cases/${entry.id}`}>
                        {entry.internalNumber}
                      </Link>
                      <div className="workspace-case-meta">{entry.kingstonNumber}</div>
                    </td>
                    <td>
                      <div className="font-medium text-white">{formatDate(entry.openedAt)}</div>
                      <div className="workspace-case-meta">Ultimo mov. {formatDate(entry.updatedAt)}</div>
                    </td>
                    <td>
                      <div className="font-medium text-white">{entry.clientName}</div>
                      <div className="workspace-case-meta">
                        {entry.owner} / {getDeliveryModeLabel(entry.deliveryMode)}
                      </div>
                    </td>
                    <td>
                      <div className="font-medium text-white">{entry.sku}</div>
                      <div className="workspace-case-meta">{entry.productDescription}</div>
                    </td>
                    <td>
                      <div className={`mb-3 text-sm font-semibold ${getToneClass(entry.externalStatus)}`}>
                        {entry.externalStatus}
                      </div>
                      <WorkflowChecklist
                        value={entry.externalStatus}
                        onChange={(status) => updateCaseStatus(entry.id, status)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionPanel>
    </div>
  );
}
