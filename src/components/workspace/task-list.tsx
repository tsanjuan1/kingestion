import Link from "next/link";

import {
  formatDateTime,
  getOwnerInitials,
  getPriorityLabel,
  getTaskStateLabel
} from "@/lib/kingston/helpers";

type TaskItem = {
  id: string;
  title: string;
  assignee: string;
  caseId: string;
  caseNumber: string;
  clientName: string;
  dueAt: string;
  priority: string;
  state: string;
};

type TaskListProps = {
  tasks: TaskItem[];
  emptyLabel: string;
};

export function TaskList({ tasks, emptyLabel }: TaskListProps) {
  if (tasks.length === 0) {
    return <div className="workspace-empty">{emptyLabel}</div>;
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <article key={task.id} className="rounded-[1rem] border border-white/10 bg-white/4 px-4 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="workspace-chip">{getPriorityLabel(task.priority)}</span>
                <span className="text-xs uppercase tracking-[0.16em] text-white/40">{getTaskStateLabel(task.state)}</span>
              </div>
              <h3 className="text-base font-semibold text-white">{task.title}</h3>
              <p className="text-sm leading-7 text-white/58">
                {task.caseNumber} / {task.clientName}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/6 text-xs font-semibold text-white/78">
                {getOwnerInitials(task.assignee)}
              </div>
              <div className="text-right text-xs uppercase tracking-[0.16em] text-white/42">
                <div>{task.assignee}</div>
                <div className="mt-1">{formatDateTime(task.dueAt)}</div>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Link className="text-sm font-medium text-[#7dd3fc]" href={`/cases/${task.caseId}`}>
              Abrir caso
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
