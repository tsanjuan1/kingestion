"use client";

import Link from "next/link";

import { MetricCard } from "@/components/workspace/metric-card";
import { SectionPanel } from "@/components/workspace/section-panel";
import { TaskList } from "@/components/workspace/task-list";
import { useKingestion } from "@/components/workspace/kingestion-provider";
import {
  formatCount,
  formatDateTime,
  getAuditActionLabel,
  getSlaLabel,
  getTeamLabel
} from "@/lib/kingston/helpers";

export function DashboardModule() {
  const { dashboardSnapshot, auditLog } = useKingestion();
  const urgentTasks = [...dashboardSnapshot.taskBuckets.overdue, ...dashboardSnapshot.taskBuckets.dueSoon].slice(0, 4);
  const recentActivity = auditLog.slice(0, 6);
  const openCasesCount = Math.max(dashboardSnapshot.openCases.length, 1);

  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="workspace-page-header-row">
          <div>
            <p className="workspace-kicker">Resumen</p>
            <h1 className="workspace-title">Pantallazo general</h1>
          </div>

          <div className="workspace-chip-row">
            <Link className="workspace-button" href="/cases">
              Ir a casos abiertos
            </Link>
            <Link className="workspace-button-secondary" href="/reports">
              Ver reportes
            </Link>
          </div>
        </div>
        <p className="workspace-subtitle">
          Vista corta para entender la situacion actual, detectar cuellos de botella y entrar al modulo correcto sin mezclar todo en la misma pantalla.
        </p>
      </header>

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
        <SectionPanel title="Casos que requieren atencion" description="Prioridad por SLA, criticidad o dependencia con Kingston.">
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

        <SectionPanel title="Tareas inmediatas" description="Vencidas o por vencer para resolver antes de que escalen.">
          <TaskList tasks={urgentTasks} emptyLabel="No hay tareas inmediatas en este momento." />
        </SectionPanel>
      </div>

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
            <div className="workspace-empty">
              Todavia no hay movimientos registrados desde esta version interactiva.
            </div>
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
                  <div className="mt-2 text-xs uppercase tracking-[0.14em] text-white/40">
                    {entry.actorName}
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionPanel>
      </div>
    </div>
  );
}
