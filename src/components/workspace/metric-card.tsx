type MetricCardProps = {
  label: string;
  value: string;
  hint: string;
};

export function MetricCard({ label, value, hint }: MetricCardProps) {
  return (
    <article className="workspace-panel space-y-4">
      <p className="workspace-kicker">{label}</p>
      <div className="flex items-end justify-between gap-4">
        <p className="text-4xl font-[var(--font-display)] tracking-[-0.06em] text-white">{value}</p>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-white/60">
          live
        </span>
      </div>
      <p className="text-sm leading-7 text-white/64">{hint}</p>
    </article>
  );
}
