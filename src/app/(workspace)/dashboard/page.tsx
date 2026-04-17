import Link from "next/link";

import { MetricCard } from "@/components/workspace/metric-card";
import { SectionPanel } from "@/components/workspace/section-panel";
import { StatusPill } from "@/components/workspace/status-pill";
import { TaskList } from "@/components/workspace/task-list";
import { formatCount, getDashboardSnapshot, getSlaLabel } from "@/lib/kingston/helpers";

const modules = [
  {
    href: "/cases",
    title: "Bandeja de casos",
    description: "Casos abiertos, filtros y acceso al detalle."
  },
  {
    href: "/tasks",
    title: "Tareas",
    description: "Vencimientos, responsables y bloqueos."
  },
  {
    href: "/reports",
    title: "Reportes",
    description: "Volumen, aging y concentracion."
  },
  {
    href: "/admin/workflow",
    title: "Flujo",
    description: "Estados, transiciones y reglas operativas."
  }
];

export default function DashboardPage() {
  const snapshot = getDashboardSnapshot();
  const openCasesCount = Math.max(snapshot.openCases.length, 1);
  const urgentTasks = [...snapshot.taskBuckets.overdue, ...snapshot.taskBuckets.dueSoon].slice(0, 4);

  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="workspace-page-header-row">
          <div>
            <p className="workspace-kicker">Inicio</p>
            <h1 className="workspace-title">Resumen operativo</h1>
          </div>

          <div className="workspace-chip-row">
            <Link className="workspace-button" href="/cases">
              Ir a casos
            </Link>
            <Link className="workspace-button-secondary" href="/tasks">
              Ver tareas
            </Link>
          </div>
        </div>
        <p className="workspace-subtitle">
          Una vista corta para entender el estado del dia y entrar rapido a cada modulo. La idea es priorizar y navegar, no resolver todo desde la misma pantalla.
        </p>
      </header>

      <section className="workspace-grid-4">
        {snapshot.headlineMetrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={formatCount(metric.value)} hint={metric.hint} />
        ))}
      </section>

      <SectionPanel title="Modulos principales" description="Accesos directos a los submodulos operativos de la aplicacion.">
        <div className="workspace-grid-2">
          {modules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="rounded-[1rem] border border-white/10 bg-white/4 px-4 py-4 transition hover:border-white/20 hover:bg-white/6"
            >
              <div className="text-lg font-semibold text-white">{module.title}</div>
              <p className="mt-2 text-sm leading-7 text-white/62">{module.description}</p>
            </Link>
          ))}
        </div>
      </SectionPanel>

      <div className="workspace-grid-2">
        <SectionPanel title="Casos prioritarios" description="Los casos que hoy conviene mirar primero por SLA o dependencia con Kingston.">
          <div className="space-y-3">
            {snapshot.criticalCases.map((entry) => (
              <Link
                key={entry.id}
                href={`/cases/${entry.id}`}
                className="block rounded-[1rem] border border-white/10 bg-white/4 px-4 py-4 transition hover:border-white/20 hover:bg-white/6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{entry.internalNumber}</div>
                    <div className="mt-1 text-sm text-white/58">{entry.clientName}</div>
                  </div>
                  <StatusPill kind="status" value={entry.externalStatus} />
                </div>
                <p className="mt-3 text-sm leading-7 text-white/68">{entry.nextAction}</p>
                <div className="mt-3 text-xs uppercase tracking-[0.16em] text-white/40">
                  {entry.owner} / {getSlaLabel(entry.slaDueAt)}
                </div>
              </Link>
            ))}
          </div>
        </SectionPanel>

        <SectionPanel title="Alertas del dia" description="Tareas vencidas o por vencer para abrir el modulo de tareas con contexto.">
          <TaskList tasks={urgentTasks} emptyLabel="No hay alertas inmediatas para el rango actual." />
        </SectionPanel>
      </div>

      <SectionPanel title="Distribucion por zona" description="Carga abierta entre Capital / AMBA e Interior / Gran Buenos Aires.">
        <div className="space-y-4">
          {snapshot.byZone.map((segment) => (
            <article key={segment.label}>
              <div className="flex items-center justify-between text-sm text-white/68">
                <span>{segment.label}</span>
                <span>{formatCount(segment.value)}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-white/6">
                <div
                  className="h-2 rounded-full bg-[linear-gradient(90deg,#38bdf8_0%,#4ade80_100%)]"
                  style={{ width: `${(segment.value / openCasesCount) * 100}%` }}
                />
              </div>
            </article>
          ))}
        </div>
      </SectionPanel>
    </div>
  );
}
