import Link from "next/link";

import { CaseTable } from "@/components/workspace/case-table";
import { MetricCard } from "@/components/workspace/metric-card";
import { SectionPanel } from "@/components/workspace/section-panel";
import { StatusPill } from "@/components/workspace/status-pill";
import { TaskList } from "@/components/workspace/task-list";
import { formatCount, getDashboardSnapshot, getSlaLabel } from "@/lib/kingston/helpers";

export default function DashboardPage() {
  const snapshot = getDashboardSnapshot();

  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="workspace-page-header-row">
          <div>
            <p className="workspace-kicker">Kingston RMA</p>
            <h1 className="workspace-title">Operations command center</h1>
          </div>

          <div className="workspace-chip-row">
            <Link className="workspace-button" href="/cases/new">
              Create case
            </Link>
            <Link className="workspace-button-secondary" href="/reports">
              Review reports
            </Link>
          </div>
        </div>
        <p className="workspace-subtitle">
          This first build already separates queue health, task ownership, delivery bottlenecks and Kingston dependency in one operating surface.
        </p>
      </header>

      <section className="workspace-grid-4">
        {snapshot.headlineMetrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={formatCount(metric.value)} hint={metric.hint} />
        ))}
      </section>

      <section className="workspace-grid-3">
        <SectionPanel title="Critical queue" description="Cases that need daily visibility because of SLA, priority or Kingston dependency.">
          <div className="space-y-3">
            {snapshot.criticalCases.map((entry) => (
              <Link
                key={entry.id}
                href={`/cases/${entry.id}`}
                className="block rounded-[1.35rem] border border-white/10 bg-white/4 px-4 py-4 transition hover:border-white/16 hover:bg-white/6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{entry.internalNumber}</div>
                    <div className="mt-1 text-sm text-white/56">{entry.clientName}</div>
                  </div>
                  <StatusPill kind="status" value={entry.externalStatus} />
                </div>
                <p className="mt-4 text-sm leading-7 text-white/62">{entry.nextAction}</p>
                <div className="mt-4 text-xs uppercase tracking-[0.16em] text-white/38">
                  {entry.owner} / {getSlaLabel(entry.slaDueAt)}
                </div>
              </Link>
            ))}
          </div>
        </SectionPanel>

        <SectionPanel title="Task pressure" description="What is due soon, blocked or already outside the operating window.">
          <div className="grid gap-4">
            <div className="rounded-[1.25rem] border border-white/10 bg-white/4 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/40">Overdue</div>
              <div className="mt-2 text-3xl font-[var(--font-display)] tracking-[-0.06em] text-white">
                {formatCount(snapshot.taskBuckets.overdue.length)}
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-white/10 bg-white/4 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/40">Due in 24h</div>
              <div className="mt-2 text-3xl font-[var(--font-display)] tracking-[-0.06em] text-white">
                {formatCount(snapshot.taskBuckets.dueSoon.length)}
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-white/10 bg-white/4 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/40">Blocked</div>
              <div className="mt-2 text-3xl font-[var(--font-display)] tracking-[-0.06em] text-white">
                {formatCount(snapshot.taskBuckets.blocked.length)}
              </div>
            </div>
          </div>
        </SectionPanel>

        <SectionPanel title="Zone split" description="Current open load between the two operating branches.">
          <div className="space-y-4">
            {snapshot.byZone.map((segment) => (
              <div key={segment.label}>
                <div className="flex items-center justify-between text-sm text-white/68">
                  <span>{segment.label}</span>
                  <span>{formatCount(segment.value)}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/6">
                  <div
                    className="h-2 rounded-full bg-[linear-gradient(90deg,#8de7dc_0%,#7bd691_100%)]"
                    style={{ width: `${(segment.value / snapshot.openCases.length) * 100}%` }}
                  />
                </div>
              </div>
            ))}

            <div className="rounded-[1.25rem] border border-white/10 bg-white/4 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/40">Average aging</div>
              <div className="mt-2 text-3xl font-[var(--font-display)] tracking-[-0.06em] text-white">
                {snapshot.averageAging}d
              </div>
            </div>
          </div>
        </SectionPanel>
      </section>

      <section className="workspace-grid-2">
        <SectionPanel
          title="Open cases"
          description="Main operating queue with owner, substatus and next action."
          aside={
            <Link className="workspace-button-secondary" href="/cases">
              Open full queue
            </Link>
          }
        >
          <CaseTable cases={snapshot.openCases} />
        </SectionPanel>

        <SectionPanel
          title="Upcoming actions"
          description="Tasks that are still inside window but should be worked today."
          aside={
            <Link className="workspace-button-secondary" href="/tasks">
              Open task desk
            </Link>
          }
        >
          <TaskList tasks={snapshot.taskBuckets.dueSoon} emptyLabel="No due-soon tasks for the next 24 hours." />
        </SectionPanel>
      </section>

      <SectionPanel title="Owner load" description="Who is carrying the queue right now and how concentrated the work is by team.">
        <div className="workspace-grid-3">
          {snapshot.ownerLoad.map((owner) => (
            <article key={owner.owner} className="rounded-[1.25rem] border border-white/10 bg-white/4 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/40">{owner.team}</div>
              <div className="mt-3 text-xl font-[var(--font-display)] tracking-[-0.05em] text-white">{owner.owner}</div>
              <div className="mt-2 text-sm text-white/60">{owner.count} active assigned cases</div>
            </article>
          ))}
        </div>
      </SectionPanel>
    </div>
  );
}
