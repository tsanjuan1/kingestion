"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { CaseTable } from "@/components/workspace/case-table";
import { SectionPanel } from "@/components/workspace/section-panel";
import { useKingestion } from "@/components/workspace/kingestion-provider";
import { workflowStates } from "@/lib/kingston/data";
import { getCasesIndex, getSearchParamValue, isClosedCaseStatus } from "@/lib/kingston/helpers";

export function SearchModule() {
  const searchParams = useSearchParams();
  const { openCases, closedCases, activeOwners, updateCaseStatus } = useKingestion();
  const allCases = [...openCases, ...closedCases];
  const filters = {
    q: getSearchParamValue(searchParams.get("q") ?? undefined) ?? "",
    status: getSearchParamValue(searchParams.get("status") ?? undefined) ?? "",
    owner: getSearchParamValue(searchParams.get("owner") ?? undefined) ?? "",
    delivery: getSearchParamValue(searchParams.get("delivery") ?? undefined) ?? "",
    zone: getSearchParamValue(searchParams.get("zone") ?? undefined) ?? "",
    lifecycle: getSearchParamValue(searchParams.get("lifecycle") ?? undefined) ?? ""
  };

  const results = getCasesIndex(filters, allCases)
    .filter((entry) => {
      if (filters.lifecycle === "open") return !isClosedCaseStatus(entry.externalStatus);
      if (filters.lifecycle === "closed") return isClosedCaseStatus(entry.externalStatus);
      return true;
    })
    .toSorted((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());

  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="workspace-page-header-row">
          <div>
            <p className="workspace-kicker">Busqueda</p>
            <h1 className="workspace-title">Busqueda de casos</h1>
          </div>
        </div>
        <p className="workspace-subtitle">
          Filtros avanzados para encontrar casos abiertos o cerrados sin recargar los modulos operativos.
        </p>
      </header>

      <SectionPanel title="Filtros de busqueda" description="Podés combinar texto libre, estado, zona, responsable y modalidad.">
        <form action="/search" className="workspace-inline-form">
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

          <div className="workspace-chip-row">
            <button className="workspace-button" type="submit">
              Buscar
            </button>
            <Link className="workspace-button-secondary" href="/search">
              Limpiar
            </Link>
          </div>
        </form>
      </SectionPanel>

      <SectionPanel title="Resultados" description={`${results.length} casos encontrados para la combinacion actual.`}>
        <CaseTable
          cases={results}
          onStatusChange={updateCaseStatus}
          emptyLabel="No hay coincidencias con los filtros actuales."
        />
      </SectionPanel>
    </div>
  );
}
