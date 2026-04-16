import Link from "next/link";

import { MetricCard } from "@/components/workspace/metric-card";
import { SectionPanel } from "@/components/workspace/section-panel";
import { TaskList } from "@/components/workspace/task-list";
import { ownerDirectory } from "@/lib/kingston/data";
import { flattenTasks, formatCount, getDashboardSnapshot, getHoursUntilDue } from "@/lib/kingston/helpers";

export default function TasksPage() {
  const snapshot = getDashboardSnapshot();
  const allTasks = flattenTasks();
  const ownerCoverage = ownerDirectory.map((owner) => ({
    name: owner.name,
    team: owner.team,
    assigned: allTasks.filter((task) => task.assignee === owner.name && task.state !== "Completed").length,
    overdue: allTasks.filter(
      (task) => task.assignee === owner.name && task.state !== "Completed" && getHoursUntilDue(task.dueAt) < 0
    ).length
  }));

  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="workspace-page-header-row">
          <div>
            <p className="workspace-kicker">Tasks</p>
            <h1 className="workspace-title">Operational task desk</h1>
          </div>

          <div className="workspace-chip-row">
            <Link className="workspace-button-secondary" href="/cases">
              Open cases
            </Link>
            <Link className="workspace-button" href="/reports">
              Review SLA
            </Link>
          </div>
        </div>
        <p className="workspace-subtitle">
          Every case should always have a current owner and a next move. This desk turns that rule into a concrete workload view across overdue, due-soon and blocked work.
        </p>
      </header>

      <section className="workspace-grid-4">
        <MetricCard label="Overdue" value={formatCount(snapshot.taskBuckets.overdue.length)} hint="Tasks already outside the committed time window." />
        <MetricCard label="Due in 24h" value={formatCount(snapshot.taskBuckets.dueSoon.length)} hint="Work that should land today to avoid SLA pressure." />
        <MetricCard label="In progress" value={formatCount(snapshot.taskBuckets.active.length)} hint="Tasks actively worked by operations, logistics or purchasing." />
        <MetricCard label="Blocked" value={formatCount(snapshot.taskBuckets.blocked.length)} hint="Cases that need a decision, dependency or exception handling." />
      </section>

      <div className="workspace-grid-2">
        <SectionPanel title="Overdue now" description="Highest-risk tasks that should drive the next coordination round.">
          <TaskList tasks={snapshot.taskBuckets.overdue} emptyLabel="No overdue tasks at the current reference timestamp." />
        </SectionPanel>

        <SectionPanel title="Due next 24 hours" description="Tasks still recoverable within SLA if the team acts today.">
          <TaskList tasks={snapshot.taskBuckets.dueSoon} emptyLabel="No tasks due in the next 24 hours." />
        </SectionPanel>
      </div>

      <div className="workspace-grid-2">
        <SectionPanel title="Blocked or waiting" description="Use this section to spot missing guide numbers, stock dependency or missing customer response.">
          <TaskList tasks={snapshot.taskBuckets.blocked} emptyLabel="There are no blocked tasks in the seeded queue." />
        </SectionPanel>

        <SectionPanel title="Ownership balance" description="Task concentration by person and team, useful to rebalance work before deadlines slip.">
          <div className="space-y-3">
            {ownerCoverage.map((owner) => (
              <article key={owner.name} className="rounded-[1.2rem] border border-white/10 bg-white/4 px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-base font-semibold text-white">{owner.name}</div>
                    <div className="mt-1 text-sm text-white/56">{owner.team}</div>
                  </div>
                  <div className="text-right text-sm text-white/68">
                    <div>{owner.assigned} active tasks</div>
                    <div className="mt-1 text-white/42">{owner.overdue} overdue</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </SectionPanel>
      </div>
    </div>
  );
}
