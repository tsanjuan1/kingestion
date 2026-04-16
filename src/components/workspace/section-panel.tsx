type SectionPanelProps = {
  kicker?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
};

export function SectionPanel({ kicker, title, description, children, aside }: SectionPanelProps) {
  return (
    <section className="workspace-panel">
      <div className="flex flex-col gap-4 border-b border-white/8 pb-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-[44rem]">
          {kicker ? <p className="workspace-kicker">{kicker}</p> : null}
          <h2 className="mt-2 text-2xl font-[var(--font-display)] tracking-[-0.05em] text-white">{title}</h2>
          {description ? <p className="mt-2 text-sm leading-7 text-white/62">{description}</p> : null}
        </div>
        {aside ? <div>{aside}</div> : null}
      </div>
      <div className="pt-6">{children}</div>
    </section>
  );
}
