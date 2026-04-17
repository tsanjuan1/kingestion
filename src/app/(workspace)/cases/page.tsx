import Link from "next/link";

import { CaseTable } from "@/components/workspace/case-table";
import { MetricCard } from "@/components/workspace/metric-card";
import { ModuleSubnav } from "@/components/workspace/module-subnav";
import { SectionPanel } from "@/components/workspace/section-panel";
import { ownerDirectory, workflowStates } from "@/lib/kingston/data";
import { formatCount, getCasesIndex, getDashboardSnapshot, getSearchParamValue } from "@/lib/kingston/helpers";

type CasesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CasesPage({ searchParams }: CasesPageProps) {
  const resolved = await searchParams;
  const filters = {
    q: getSearchParamValue(resolved.q) ?? "",
    status: getSearchParamValue(resolved.status) ?? "",
    zone: getSearchParamValue(resolved.zone) ?? "",
    owner: getSearchParamValue(resolved.owner) ?? "",
    delivery: getSearchParamValue(resolved.delivery) ?? ""
  };

  const snapshot = getDashboardSnapshot();
  const cases = getCasesIndex(filters);

  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="workspace-page-header-row">
          <div>
            <p className="workspace-kicker">Casos</p>
            <h1 className="workspace-title">Bandeja operativa</h1>
          </div>

          <div className="workspace-chip-row">
            <Link className="workspace-button" href="/cases/new">
              Nuevo caso
            </Link>
            <Link className="workspace-button-secondary" href="/tasks">
              Ver tareas
            </Link>
          </div>
        </div>
        <p className="workspace-subtitle">
          Un modulo dedicado a buscar, filtrar y abrir casos. Los detalles viven dentro de cada caso, no en esta misma vista.
        </p>
      </header>

      <ModuleSubnav
        items={[
          { href: "/cases", label: "Bandeja", active: true },
          { href: "/cases/new", label: "Nuevo caso" }
        ]}
      />

      <section className="workspace-grid-3">
        <MetricCard label="Casos abiertos" value={formatCount(snapshot.openCases.length)} hint="Casos activos fuera de estados terminales." />
        <MetricCard
          label="Pedido a Kingston"
          value={formatCount(snapshot.openCases.filter((entry) => entry.externalStatus === "Pedido a Kingston").length)}
          hint="Casos que dependen de reposicion o arribo."
        />
        <MetricCard
          label="Listos para retiro"
          value={formatCount(snapshot.openCases.filter((entry) => entry.externalStatus === "Producto listo para retiro").length)}
          hint="Mostrador con entrega pendiente."
        />
      </section>

      <SectionPanel title="Buscar y filtrar" description="Filtros reales por URL para que la bandeja ya sea navegable y compartible.">
        <form action="/cases" className="workspace-inline-form">
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
                {ownerDirectory.map((owner) => (
                  <option key={owner.name} value={owner.name}>
                    {owner.name}
                  </option>
                ))}
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
            <Link className="workspace-button-secondary" href="/cases">
              Limpiar
            </Link>
          </div>
        </form>
      </SectionPanel>

      <SectionPanel title={`Resultados (${cases.length})`} description="Listado principal para abrir el detalle del caso o seguir la operacion.">
        <CaseTable cases={cases} />
      </SectionPanel>
    </div>
  );
}
