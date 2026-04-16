import { formatDateTime } from "@/lib/kingston/helpers";
import type { CaseEvent } from "@/lib/kingston/types";

type EventTimelineProps = {
  events: CaseEvent[];
};

export function EventTimeline({ events }: EventTimelineProps) {
  return (
    <div className="space-y-4">
      {events.map((event) => (
        <article key={event.id} className="grid gap-4 md:grid-cols-[140px_minmax(0,1fr)]">
          <div className="text-xs uppercase tracking-[0.16em] text-white/38">{formatDateTime(event.createdAt)}</div>
          <div className="rounded-[1.35rem] border border-white/10 bg-white/4 px-4 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[0.65rem] uppercase tracking-[0.16em] text-white/48">
                {event.kind}
              </span>
              <span className="text-xs uppercase tracking-[0.16em] text-white/36">{event.actor}</span>
            </div>
            <h3 className="mt-3 text-base font-semibold text-white">{event.title}</h3>
            <p className="mt-2 text-sm leading-7 text-white/62">{event.detail}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
