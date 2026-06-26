"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { MetricCard } from "@/components/workspace/metric-card";
import { SectionPanel } from "@/components/workspace/section-panel";
import { useKingestion } from "@/components/workspace/kingestion-provider";
import { downloadPdfReport } from "@/lib/kingston/pdf";
import { formatCount, formatDate } from "@/lib/kingston/helpers";
import type { KingstonCase } from "@/lib/kingston/types";

type ReportPeriodMode = "monthly" | "quarterly" | "semester" | "yearly";

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre"
] as const;

const QUARTERS = [
  { value: 1, label: "Enero a marzo", startMonth: 0, endMonth: 3 },
  { value: 2, label: "Abril a junio", startMonth: 3, endMonth: 6 },
  { value: 3, label: "Julio a septiembre", startMonth: 6, endMonth: 9 },
  { value: 4, label: "Octubre a diciembre", startMonth: 9, endMonth: 12 }
] as const;

const SEMESTERS = [
  { value: 1, label: "Enero a junio", startMonth: 0, endMonth: 6 },
  { value: 2, label: "Julio a diciembre", startMonth: 6, endMonth: 12 }
] as const;

function buildYearOptions(cases: KingstonCase[]) {
  const currentYear = new Date().getFullYear();
  const years = new Set<number>([currentYear]);

  cases.forEach((entry) => {
    const year = new Date(entry.openedAt).getFullYear();
    if (Number.isFinite(year)) {
      years.add(year);
    }
  });

  return Array.from(years).sort((left, right) => right - left);
}

function buildPeriodRange(input: {
  mode: ReportPeriodMode;
  year: number;
  month: number;
  quarter: number;
  semester: number;
}) {
  if (input.mode === "monthly") {
    return {
      label: `${MONTHS[input.month]} ${input.year}`,
      start: new Date(input.year, input.month, 1),
      end: new Date(input.year, input.month + 1, 1)
    };
  }

  if (input.mode === "quarterly") {
    const quarter = QUARTERS.find((entry) => entry.value === input.quarter) ?? QUARTERS[0];
    return {
      label: `${quarter.label} ${input.year}`,
      start: new Date(input.year, quarter.startMonth, 1),
      end: new Date(input.year, quarter.endMonth, 1)
    };
  }

  if (input.mode === "semester") {
    const semester = SEMESTERS.find((entry) => entry.value === input.semester) ?? SEMESTERS[0];
    return {
      label: `${semester.label} ${input.year}`,
      start: new Date(input.year, semester.startMonth, 1),
      end: new Date(input.year, semester.endMonth, 1)
    };
  }

  return {
    label: `Año ${input.year}`,
    start: new Date(input.year, 0, 1),
    end: new Date(input.year + 1, 0, 1)
  };
}

function sanitizePdfCell(value: string | number | null | undefined) {
  return String(value ?? "-").replace(/\s+/g, " ").trim() || "-";
}

export function ReportsModule() {
  const { cases, recordReportDownload, canAccessModule } = useKingestion();
  const today = new Date();
  const [periodMode, setPeriodMode] = useState<ReportPeriodMode>("quarterly");
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedQuarter, setSelectedQuarter] = useState(Math.floor(today.getMonth() / 3) + 1);
  const [selectedSemester, setSelectedSemester] = useState(today.getMonth() < 6 ? 1 : 2);

  const reportableCases = useMemo(() => cases.filter((entry) => !entry.archivedAt), [cases]);
  const yearOptions = useMemo(() => buildYearOptions(reportableCases), [reportableCases]);
  const period = useMemo(
    () =>
      buildPeriodRange({
        mode: periodMode,
        year: selectedYear,
        month: selectedMonth,
        quarter: selectedQuarter,
        semester: selectedSemester
      }),
    [periodMode, selectedYear, selectedMonth, selectedQuarter, selectedSemester]
  );

  const periodCases = useMemo(() => {
    const startTime = period.start.getTime();
    const endTime = period.end.getTime();

    return reportableCases
      .filter((entry) => {
        const openedAt = new Date(entry.openedAt).getTime();
        return Number.isFinite(openedAt) && openedAt >= startTime && openedAt < endTime;
      })
      .toSorted((left, right) => new Date(left.openedAt).getTime() - new Date(right.openedAt).getTime());
  }, [period, reportableCases]);

  const totalUnits = periodCases.reduce((total, entry) => total + entry.quantity, 0);
  const totalClients = new Set(periodCases.map((entry) => entry.clientName)).size;
  const totalZones = new Set(periodCases.map((entry) => entry.zone)).size;

  const reportPayload = useMemo(
    () => ({
      title: `Reporte RMA Kingston - ${period.label}`,
      filename: `kingestion-reporte-${period.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`,
      lines: [
        `Periodo: ${period.label}`,
        "",
        "Fecha | Cliente | Nro de caso | SKU fallado | SKU reemplazo | Cantidad | Zona",
        ...(
          periodCases.length > 0
            ? periodCases.map((entry) =>
                [
                  formatDate(entry.openedAt),
                  sanitizePdfCell(entry.clientName),
                  sanitizePdfCell(entry.internalNumber),
                  sanitizePdfCell(entry.sku),
                  sanitizePdfCell(entry.replacementSku),
                  sanitizePdfCell(entry.quantity),
                  sanitizePdfCell(entry.zone)
                ].join(" | ")
              )
            : ["Sin casos para el periodo seleccionado."]
        )
      ]
    }),
    [period.label, periodCases]
  );

  const handleDownload = () => {
    void downloadPdfReport(reportPayload).then(() => {
      void recordReportDownload(reportPayload.title);
    });
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
      <section className="workspace-page-header-row">
        <div>
          <div className="workspace-kicker">Reportes</div>
          <h1 className="workspace-title">Informe operativo por periodo</h1>
          <p className="workspace-subtitle">
            Reportes mensuales, trimestrales, semestrales o anuales con la informacion operativa solicitada.
          </p>
        </div>
        <div className="workspace-inline-actions">
          <button className="workspace-button" type="button" onClick={handleDownload}>
            Descargar PDF
          </button>
          <Link className="workspace-button-secondary" href="/cases">
            Ver casos
          </Link>
        </div>
      </section>

      <SectionPanel title="Periodo del reporte" description="Elegí el rango que queres incluir en el informe.">
        <div className="workspace-form-grid">
          <label className="workspace-label">
            <span>Tipo</span>
            <select
              className="workspace-select"
              value={periodMode}
              onChange={(event) => setPeriodMode(event.target.value as ReportPeriodMode)}
            >
              <option value="monthly">Mensual</option>
              <option value="quarterly">Trimestre</option>
              <option value="semester">Semestre</option>
              <option value="yearly">Año</option>
            </select>
          </label>

          <label className="workspace-label">
            <span>Año</span>
            <select
              className="workspace-select"
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          {periodMode === "monthly" ? (
            <label className="workspace-label">
              <span>Mes</span>
              <select
                className="workspace-select"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(Number(event.target.value))}
              >
                {MONTHS.map((month, index) => (
                  <option key={month} value={index}>
                    {month}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {periodMode === "quarterly" ? (
            <label className="workspace-label">
              <span>Trimestre</span>
              <select
                className="workspace-select"
                value={selectedQuarter}
                onChange={(event) => setSelectedQuarter(Number(event.target.value))}
              >
                {QUARTERS.map((quarter) => (
                  <option key={quarter.value} value={quarter.value}>
                    {quarter.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {periodMode === "semester" ? (
            <label className="workspace-label">
              <span>Semestre</span>
              <select
                className="workspace-select"
                value={selectedSemester}
                onChange={(event) => setSelectedSemester(Number(event.target.value))}
              >
                {SEMESTERS.map((semester) => (
                  <option key={semester.value} value={semester.value}>
                    {semester.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </SectionPanel>

      <section className="workspace-grid-4">
        <MetricCard label="Casos" value={formatCount(periodCases.length)} hint={period.label} />
        <MetricCard label="Unidades" value={formatCount(totalUnits)} hint="Cantidad total informada" />
        <MetricCard label="Clientes" value={formatCount(totalClients)} hint="Clientes unicos del periodo" />
        <MetricCard label="Zonas" value={formatCount(totalZones)} hint="Zonas con actividad" />
      </section>

      <SectionPanel title="Detalle del reporte" description="La descarga PDF usa estas mismas columnas.">
        {periodCases.length === 0 ? (
          <div className="workspace-empty">No hay casos para el periodo seleccionado.</div>
        ) : (
          <div className="workspace-table-wrap">
            <table className="workspace-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Nro de caso</th>
                  <th>SKU fallado</th>
                  <th>SKU reemplazo</th>
                  <th>Cantidad</th>
                  <th>Zona</th>
                </tr>
              </thead>
              <tbody>
                {periodCases.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDate(entry.openedAt)}</td>
                    <td>{entry.clientName}</td>
                    <td>{entry.internalNumber}</td>
                    <td>{entry.sku}</td>
                    <td>{entry.replacementSku || "-"}</td>
                    <td>{formatCount(entry.quantity)}</td>
                    <td>{entry.zone}</td>
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
