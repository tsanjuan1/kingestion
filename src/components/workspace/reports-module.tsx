"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { MetricCard } from "@/components/workspace/metric-card";
import { ModuleSubnav } from "@/components/workspace/module-subnav";
import { SectionPanel } from "@/components/workspace/section-panel";
import { useKingestion } from "@/components/workspace/kingestion-provider";
import { downloadPdfReport } from "@/lib/kingston/pdf";
import { formatCount, getAuditActionLabel, getTeamLabel } from "@/lib/kingston/helpers";

type ReportView = "general" | "estados" | "clientes" | "sku" | "auditoria";

function getReportView(value: string | null): ReportView {
  switch (value) {
    case "estados":
    case "clientes":
    case "sku":
    case "auditoria":
      return value;
    default:
      return "general";
  }
}

export function ReportsModule() {
  const searchParams = useSearchParams();
  const view = getReportView(searchParams.get("view"));
  const { reportsSnapshot, dashboardSnapshot, auditLog, recordReportDownload, canAccessModule } = useKingestion();
  const maxStatus = Math.max(...dashboardSnapshot.byStatus.map((entry) => entry.count), 1);
  const maxClient = Math.max(...reportsSnapshot.byClient.map((entry) => entry.value), 1);
  const maxSku = Math.max(...reportsSnapshot.bySku.map((entry) => entry.value), 1);

  const reportPayload = useMemo(() => {
    if (view === "estados") {
      return {
        title: "Reporte por estado",
        filename: "kingestion-reporte-estados.pdf",
        lines: dashboardSnapshot.byStatus.map((entry) => `${entry.status}: ${entry.count} casos`)
      };
    }

    if (view === "clientes") {
      return {
        title: "Reporte por cliente",
        filename: "kingestion-reporte-clientes.pdf",
        lines: reportsSnapshot.byClient.map((entry) => `${entry.label}: ${entry.value} casos`)
      };
    }

    if (view === "sku") {
      return {
        title: "Reporte por SKU",
        filename: "kingestion-reporte-sku.pdf",
        lines: reportsSnapshot.bySku.map((entry) => `${entry.label}: ${entry.value} unidades`)
      };
    }

    if (view === "auditoria") {
      return {
        title: "Reporte de auditoria",
        filename: "kingestion-reporte-auditoria.pdf",
        lines: auditLog
          .slice(0, 40)
          .map((entry) => `${entry.actorName} | ${getAuditActionLabel(entry.action)} | ${entry.detail}`)
      };
    }

    return {
      title: "Reporte general",
      filename: "kingestion-reporte-general.pdf",
      lines: [
        ...reportsSnapshot.throughput.map((entry) => `${entry.label}: ${entry.value}`),
        "",
        "Carga por responsable:",
        ...dashboardSnapshot.ownerLoad.map(
          (entry) => `${entry.owner} (${getTeamLabel(entry.team)}): ${entry.count} casos`
        )
      ]
    };
  }, [auditLog, dashboardSnapshot.byStatus, dashboardSnapshot.ownerLoad, reportsSnapshot.byClient, reportsSnapshot.bySku, reportsSnapshot.throughput, view]);

  const handleDownload = () => {
    downloadPdfReport(reportPayload);
    void recordReportDownload(reportPayload.title);
  };

  if (!canAccessModule("reports")) {
    return (
      <div className="workspace-page">
        <SectionPanel title="Sin permisos" description="Tu usuario no tiene acceso al modulo Reportes.">
          <div className="workspace-empty">Pedi al administrador que revise tus permisos.</div>
        </SectionPanel>
      </div>
    );
  }

  return (
    <div className="workspace-page">
      <ModuleSubnav
        items={[
          { href: "/reports?view=general", label: "General", active: view === "general" },
          { href: "/reports?view=estados", label: "Por estado", active: view === "estados" },
          { href: "/reports?view=clientes", label: "Por cliente", active: view === "clientes" },
          { href: "/reports?view=sku", label: "Por SKU", active: view === "sku" },
          { href: "/reports?view=auditoria", label: "Auditoria", active: view === "auditoria" }
        ]}
        aside={
          <div className="workspace-inline-actions">
            <button className="workspace-button" type="button" onClick={handleDownload}>
              Descargar PDF
            </button>
            <Link className="workspace-button-secondary" href="/cases">
              Ver casos
            </Link>
          </div>
        }
      />

      <section className="workspace-grid-4">
        {reportsSnapshot.throughput.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={formatCount(metric.value)} hint={metric.hint} />
        ))}
      </section>

      {view === "general" ? (
        <SectionPanel title="Resumen general" description="Lectura consolidada para entender carga y salida del flujo.">
          <div className="workspace-grid-2">
            {dashboardSnapshot.ownerLoad.map((entry) => (
              <article key={entry.owner} className="workspace-list-card">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-base font-semibold text-white">{entry.owner}</div>
                    <div className="mt-1 text-sm text-white/58">{getTeamLabel(entry.team)}</div>
                  </div>
                  <div className="text-2xl font-[var(--font-display)] tracking-[-0.06em] text-white">
                    {formatCount(entry.count)}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </SectionPanel>
      ) : null}

      {view === "estados" ? (
        <SectionPanel title="Distribucion por estado" description="Cuantos casos hay en cada etapa del flujo actual.">
          <div className="space-y-4">
            {dashboardSnapshot.byStatus.map((entry) => (
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
        <SectionPanel title="Volumen por cliente" description="Clientes con mayor cantidad de casos en el sistema.">
          <div className="space-y-4">
            {reportsSnapshot.byClient.map((entry) => (
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
        <SectionPanel title="Volumen por SKU" description="SKU con mayor cantidad de unidades involucradas.">
          <div className="space-y-4">
            {reportsSnapshot.bySku.map((entry) => (
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

      {view === "auditoria" ? (
        <SectionPanel title="Auditoria de interacciones" description="Registro de quien hizo que y en que momento.">
          {auditLog.length === 0 ? (
            <div className="workspace-empty">Todavia no hay acciones registradas para exportar.</div>
          ) : (
            <div className="workspace-table-wrap">
              <table className="workspace-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Accion</th>
                    <th>Detalle</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.slice(0, 30).map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.actorName}</td>
                      <td>{getAuditActionLabel(entry.action)}</td>
                      <td>{entry.detail}</td>
                      <td>{new Date(entry.createdAt).toLocaleString("es-AR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionPanel>
      ) : null}
    </div>
  );
}
