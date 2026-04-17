import Link from "next/link";

type ModuleSubnavItem = {
  href: string;
  label: string;
  active?: boolean;
};

type ModuleSubnavProps = {
  items: ModuleSubnavItem[];
};

export function ModuleSubnav({ items }: ModuleSubnavProps) {
  return (
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
  );
}
