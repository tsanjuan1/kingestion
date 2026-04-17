import { formatDateTime, getEventKindLabel } from "@/lib/kingston/helpers";
import type { CaseEvent } from "@/lib/kingston/types";

type EventTimelineProps = {
  events: CaseEvent[];
};

export function EventTimeline({ events }: EventTimelineProps) {
  return (
    <div className="space-y-4">
      {events.map((event) => (
        <article key={event.id} className="grid gap-3 md:grid-cols-[170px_minmax(0,1fr)]">
          <div className="text-xs uppercase tracking-[0.16em] text-white/38">{formatDateTime(event.createdAt)}</div>
          <div className="rounded-[1rem] border border-white/10 bg-white/4 px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="workspace-chip">{getEventKindLabel(event.kind)}</span>
              <span className="text-xs uppercase tracking-[0.16em] text-white/38">{event.actor}</span>
            </div>
            <h3 className="mt-3 text-base font-semibold text-white">{event.title}</h3>
            <p className="mt-2 text-sm leading-7 text-white/66">{event.detail}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
