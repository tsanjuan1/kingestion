type MetricCardProps = {
  label: string;
  value: string;
  hint: string;
};

export function MetricCard({ label, value, hint }: MetricCardProps) {
  return (
    <article className="workspace-panel space-y-3">
      <div className="flex items-start justify-between gap-4">
        <p className="workspace-kicker">{label}</p>
        <span className="workspace-chip">hoy</span>
      </div>
      <p className="text-4xl font-[var(--font-display)] tracking-[-0.06em] text-white">{value}</p>
      <p className="text-sm leading-7 text-white/64">{hint}</p>
    </article>
  );
}
