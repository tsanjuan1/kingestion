import Link from "next/link";

type ModuleSubnavItem = {
  href: string;
  label: string;
  active?: boolean;
};

type ModuleSubnavProps = {
  items: ModuleSubnavItem[];
  aside?: React.ReactNode;
};

export function ModuleSubnav({ items, aside }: ModuleSubnavProps) {
  return (
    <div className="workspace-subnav-row">
      <nav className="workspace-subnav" aria-label="Submodulos">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`workspace-subnav-link ${item.active ? "workspace-subnav-link-active" : ""}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {aside ? <div className="workspace-subnav-aside">{aside}</div> : null}
    </div>
  );
}
