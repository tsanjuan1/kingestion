import Link from "next/link";

import { formatDateTime, getOwnerInitials } from "@/lib/kingston/helpers";

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
    return (
      <div className="rounded-[1.35rem] border border-dashed border-white/12 bg-white/3 px-5 py-6 text-sm text-white/50">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <article
          key={task.id}
          className="rounded-[1.35rem] border border-white/10 bg-[rgba(255,255,255,0.03)] px-4 py-4"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/6 px-2 py-1 text-[0.67rem] uppercase tracking-[0.16em] text-white/62">
                  {task.priority}
                </span>
                <span className="text-xs uppercase tracking-[0.18em] text-white/36">{task.state}</span>
              </div>
              <h3 className="text-base font-semibold text-white">{task.title}</h3>
              <p className="text-sm leading-7 text-white/56">
                {task.caseNumber} / {task.clientName}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/6 text-xs font-semibold text-white/78">
                {getOwnerInitials(task.assignee)}
              </div>
              <div className="text-right text-xs uppercase tracking-[0.16em] text-white/45">
                <div>{task.assignee}</div>
                <div className="mt-1">{formatDateTime(task.dueAt)}</div>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Link className="text-sm font-medium text-[#8de7dc]" href={`/cases/${task.caseId}`}>
              Abrir caso
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
