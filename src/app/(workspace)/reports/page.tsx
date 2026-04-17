import Link from "next/link";

import { MetricCard } from "@/components/workspace/metric-card";
import { ModuleSubnav } from "@/components/workspace/module-subnav";
import { SectionPanel } from "@/components/workspace/section-panel";
import { formatCount, getDashboardSnapshot, getReportsSnapshot } from "@/lib/kingston/helpers";

type ReportsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const resolved = await searchParams;
  const view = Array.isArray(resolved.view) ? resolved.view[0] : resolved.view ?? "general";
  const snapshot = getDashboardSnapshot();
  const reports = getReportsSnapshot();
  const maxStatus = Math.max(...snapshot.byStatus.map((entry) => entry.count), 1);
  const maxClient = Math.max(...reports.byClient.map((entry) => entry.value), 1);
  const maxSku = Math.max(...reports.bySku.map((entry) => entry.value), 1);

  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="workspace-page-header-row">
          <div>
            <p className="workspace-kicker">Operacion</p>
            <h1 className="workspace-title">Reportes</h1>
          </div>

          <div className="workspace-chip-row">
            <Link className="workspace-button-secondary" href="/dashboard">
              Volver al inicio
            </Link>
            <Link className="workspace-button" href="/cases">
              Ver casos
            </Link>
          </div>
        </div>
        <p className="workspace-subtitle">
          Reportes separados por tema para no mezclar todo en una misma vista: general, estados, clientes y SKU.
        </p>
      </header>

      <ModuleSubnav
        items={[
          { href: "/reports?view=general", label: "General", active: view === "general" },
          { href: "/reports?view=estados", label: "Por estado", active: view === "estados" },
          { href: "/reports?view=clientes", label: "Por cliente", active: view === "clientes" },
          { href: "/reports?view=sku", label: "Por SKU", active: view === "sku" }
        ]}
      />

      <section className="workspace-grid-4">
        {reports.throughput.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={formatCount(metric.value)} hint={metric.hint} />
        ))}
      </section>

      {view === "general" ? (
        <SectionPanel title="Resumen general" description="Lectura rapida del estado actual de la operacion.">
          <div className="workspace-grid-2">
            <article className="rounded-[1rem] border border-white/10 bg-white/4 px-4 py-4">
              <div className="text-base font-semibold text-white">Casos con dependencia Kingston</div>
              <p className="mt-2 text-sm leading-7 text-white/64">
                {snapshot.openCases.filter((entry) => entry.externalStatus === "Pedido a Kingston").length} casos abiertos estan esperando reposicion o arribo.
              </p>
            </article>
            <article className="rounded-[1rem] border border-white/10 bg-white/4 px-4 py-4">
              <div className="text-base font-semibold text-white">Carga de retiro</div>
              <p className="mt-2 text-sm leading-7 text-white/64">
                {snapshot.openCases.filter((entry) => entry.externalStatus === "Producto listo para retiro").length} casos estan listos para mostrador.
              </p>
            </article>
          </div>
        </SectionPanel>
      ) : null}

      {view === "estados" ? (
        <SectionPanel title="Distribucion por estado" description="Cuantos casos abiertos hay en cada tramo del flujo.">
          <div className="space-y-4">
            {snapshot.byStatus.map((entry) => (
              <article key={entry.status}>
                <div className="flex items-center justify-between text-sm text-white/68">
                  <span>{entry.status}</span>
                  <span>{formatCount(entry.count)}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/6">
                  <div
                    className="h-2 rounded-full bg-[linear-gradient(90deg,#38bdf8_0%,#4ade80_100%)]"
                    style={{ width: `${(entry.count / maxStatus) * 100}%` }}
                  />
                </div>
              </article>
            ))}
          </div>
        </SectionPanel>
      ) : null}

      {view === "clientes" ? (
        <SectionPanel title="Top clientes" description="Clientes con mayor volumen de casos en la muestra actual.">
          <div className="space-y-4">
            {reports.byClient.map((entry) => (
              <article key={entry.label}>
                <div className="flex items-center justify-between text-sm text-white/68">
                  <span>{entry.label}</span>
                  <span>{formatCount(entry.value)}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/6">
                  <div
                    className="h-2 rounded-full bg-[linear-gradient(90deg,#38bdf8_0%,#0ea5e9_100%)]"
                    style={{ width: `${(entry.value / maxClient) * 100}%` }}
                  />
                </div>
              </article>
            ))}
          </div>
        </SectionPanel>
      ) : null}

      {view === "sku" ? (
        <SectionPanel title="Top SKU" description="SKU con mayor cantidad total dentro de la muestra.">
          <div className="space-y-4">
            {reports.bySku.map((entry) => (
              <article key={entry.label}>
                <div className="flex items-center justify-between text-sm text-white/68">
                  <span>{entry.label}</span>
                  <span>{formatCount(entry.value)}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/6">
                  <div
                    className="h-2 rounded-full bg-[linear-gradient(90deg,#4ade80_0%,#22c55e_100%)]"
                    style={{ width: `${(entry.value / maxSku) * 100}%` }}
                  />
                </div>
              </article>
            ))}
          </div>
        </SectionPanel>
      ) : null}
    </div>
  );
}
