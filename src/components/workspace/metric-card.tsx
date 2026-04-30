type MetricCardProps = {
  label: string;
  value: string;
  hint: string;
};

type MetricVisual = {
  accentClass: string;
  icon: React.ReactNode;
};

function resolveMetricVisual(label: string): MetricVisual {
  const normalizedLabel = label.toLowerCase();

  if (normalizedLabel.includes("abierto")) {
    return {
      accentClass: "workspace-metric-accent-cyan",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="workspace-metric-icon-svg">
          <path d="M5 16.5V12m4 4.5V9m4 7.5V6m4 10.5v-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M4 18.5h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    };
  }

  if (normalizedLabel.includes("cerrado")) {
    return {
      accentClass: "workspace-metric-accent-yellow",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="workspace-metric-icon-svg">
          <path d="M7 8.5h10M7 12h10M7 15.5h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <rect x="4" y="5" width="16" height="14" rx="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
    };
  }

  if (normalizedLabel.includes("kingston")) {
    return {
      accentClass: "workspace-metric-accent-violet",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="workspace-metric-icon-svg">
          <path d="M12 4.2 18.8 8v8L12 19.8 5.2 16V8z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M12 4.2v15.6M5.2 8 12 12l6.8-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      )
    };
  }

  return {
    accentClass: "workspace-metric-accent-green",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="workspace-metric-icon-svg">
        <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 8.7v6.6M9.5 10.3c.3-1 1.2-1.6 2.5-1.6 1.4 0 2.3.7 2.3 1.7 0 .9-.5 1.3-2.2 1.7-1.5.4-2.1.8-2.1 1.8 0 1 .9 1.7 2.4 1.7 1.2 0 2.1-.5 2.5-1.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  };
}

export function MetricCard({ label, value, hint }: MetricCardProps) {
  const visual = resolveMetricVisual(label);

  return (
    <article className="workspace-panel workspace-metric-card">
      <div className="workspace-metric-card-head">
        <div className="space-y-2">
          <p className="workspace-kicker">{label}</p>
          <p className="workspace-metric-value">{value}</p>
        </div>
        <div className={`workspace-metric-icon ${visual.accentClass}`}>{visual.icon}</div>
      </div>
      <p className="workspace-metric-hint">{hint}</p>
    </article>
  );
}
