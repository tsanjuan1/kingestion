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
      <div className="workspace-panel-header">
        <div className="max-w-[44rem]">
          {kicker ? <p className="workspace-kicker">{kicker}</p> : null}
          <h2 className="workspace-panel-title">{title}</h2>
          {description ? <p className="workspace-panel-description">{description}</p> : null}
        </div>
        {aside ? <div>{aside}</div> : null}
      </div>
      <div className="pt-5">{children}</div>
    </section>
  );
}
