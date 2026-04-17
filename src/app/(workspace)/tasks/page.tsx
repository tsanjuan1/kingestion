import Link from "next/link";

import { MetricCard } from "@/components/workspace/metric-card";
import { ModuleSubnav } from "@/components/workspace/module-subnav";
import { SectionPanel } from "@/components/workspace/section-panel";
import { TaskList } from "@/components/workspace/task-list";
import { ownerDirectory } from "@/lib/kingston/data";
import {
  flattenTasks,
  formatCount,
  getDashboardSnapshot,
  getHoursUntilDue,
  getTeamLabel
} from "@/lib/kingston/helpers";

type TasksPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const resolved = await searchParams;
  const view = Array.isArray(resolved.view) ? resolved.view[0] : resolved.view ?? "vencidas";
  const snapshot = getDashboardSnapshot();
  const allTasks = flattenTasks();
  const ownerCoverage = ownerDirectory.map((owner) => ({
    name: owner.name,
    team: getTeamLabel(owner.team),
    assigned: allTasks.filter((task) => task.assignee === owner.name && task.state !== "Completed").length,
    overdue: allTasks.filter(
      (task) => task.assignee === owner.name && task.state !== "Completed" && getHoursUntilDue(task.dueAt) < 0
    ).length
  }));

  const views = [
    { href: "/tasks?view=vencidas", label: "Vencidas", active: view === "vencidas" },
    { href: "/tasks?view=por-vencer", label: "Por vencer", active: view === "por-vencer" },
    { href: "/tasks?view=en-curso", label: "En curso", active: view === "en-curso" },
    { href: "/tasks?view=bloqueadas", label: "Bloqueadas", active: view === "bloqueadas" },
    { href: "/tasks?view=responsables", label: "Responsables", active: view === "responsables" }
  ];

  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="workspace-page-header-row">
          <div>
            <p className="workspace-kicker">Operacion</p>
            <h1 className="workspace-title">Tareas</h1>
          </div>

          <div className="workspace-chip-row">
            <Link className="workspace-button-secondary" href="/cases">
              Ir a casos
            </Link>
            <Link className="workspace-button" href="/reports">
              Ver reportes
            </Link>
          </div>
        </div>
        <p className="workspace-subtitle">
          Este modulo esta pensado para priorizar trabajo. Cada submodulo muestra una sola perspectiva: vencimientos, tareas activas o carga por responsable.
        </p>
      </header>

      <ModuleSubnav items={views} />

      <section className="workspace-grid-4">
        <MetricCard label="Vencidas" value={formatCount(snapshot.taskBuckets.overdue.length)} hint="Fuera de ventana comprometida." />
        <MetricCard label="Por vencer" value={formatCount(snapshot.taskBuckets.dueSoon.length)} hint="Dentro de las proximas 24 horas." />
        <MetricCard label="En curso" value={formatCount(snapshot.taskBuckets.active.length)} hint="Trabajo que ya esta siendo atendido." />
        <MetricCard label="Bloqueadas" value={formatCount(snapshot.taskBuckets.blocked.length)} hint="Pendientes de decision o dependencia." />
      </section>

      {view === "vencidas" ? (
        <SectionPanel title="Tareas vencidas" description="Lo primero a resolver para descomprimir SLA.">
          <TaskList tasks={snapshot.taskBuckets.overdue} emptyLabel="No hay tareas vencidas en este momento." />
        </SectionPanel>
      ) : null}

      {view === "por-vencer" ? (
        <SectionPanel title="Tareas por vencer" description="Trabajo recuperable si se toma hoy.">
          <TaskList tasks={snapshot.taskBuckets.dueSoon} emptyLabel="No hay tareas por vencer dentro de las proximas 24 horas." />
        </SectionPanel>
      ) : null}

      {view === "en-curso" ? (
        <SectionPanel title="Tareas en curso" description="Seguimiento de lo que ya esta en ejecucion.">
          <TaskList tasks={snapshot.taskBuckets.active} emptyLabel="No hay tareas en curso para el rango actual." />
        </SectionPanel>
      ) : null}

      {view === "bloqueadas" ? (
        <SectionPanel title="Tareas bloqueadas" description="Casos que necesitan una definicion antes de avanzar.">
          <TaskList tasks={snapshot.taskBuckets.blocked} emptyLabel="No hay tareas bloqueadas en la cola actual." />
        </SectionPanel>
      ) : null}

      {view === "responsables" ? (
        <SectionPanel title="Carga por responsable" description="Balance simple para detectar sobrecarga o necesidad de reasignar.">
          <div className="space-y-3">
            {ownerCoverage.map((owner) => (
              <article key={owner.name} className="rounded-[1rem] border border-white/10 bg-white/4 px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-base font-semibold text-white">{owner.name}</div>
                    <div className="mt-1 text-sm text-white/58">{owner.team}</div>
                  </div>
                  <div className="text-right text-sm text-white/66">
                    <div>{owner.assigned} activas</div>
                    <div className="mt-1 text-white/42">{owner.overdue} vencidas</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </SectionPanel>
      ) : null}
    </div>
  );
}
