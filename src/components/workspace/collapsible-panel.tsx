"use client";

import { useState } from "react";

type CollapsiblePanelProps = {
  kicker?: string;
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  aside?: React.ReactNode;
};

export function CollapsiblePanel({
  kicker,
  title,
  description,
  defaultOpen = false,
  children,
  aside
}: CollapsiblePanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="workspace-panel workspace-collapsible">
      <button
        type="button"
        className="workspace-collapsible-toggle"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        <div className="workspace-collapsible-copy">
          {kicker ? <p className="workspace-kicker">{kicker}</p> : null}
          <h2 className="workspace-panel-title">{title}</h2>
          {description ? <p className="workspace-panel-description">{description}</p> : null}
        </div>
        <div className="workspace-collapsible-actions">
          {aside}
          <span className="workspace-collapsible-indicator">{isOpen ? "Ocultar" : "Ver"}</span>
        </div>
      </button>

      {isOpen ? <div className="workspace-collapsible-body">{children}</div> : null}
    </section>
  );
}
