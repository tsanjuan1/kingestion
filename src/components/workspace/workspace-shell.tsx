"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { getDashboardSnapshot, getOwnerInitials } from "@/lib/kingston/helpers";

const primaryNavigation = [
  { href: "/dashboard", label: "Dashboard", hint: "Pulse and bottlenecks" },
  { href: "/cases", label: "Cases", hint: "Open queue and filters" },
  { href: "/tasks", label: "Tasks", hint: "Ownership and due dates" },
  { href: "/reports", label: "Reports", hint: "Throughput and aging" },
  { href: "/admin/workflow", label: "Workflow", hint: "States and rules" }
];

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const snapshot = getDashboardSnapshot();

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <div>
          <Link href="/dashboard" className="text-[1.28rem] font-[var(--font-display)] tracking-[0.08em] text-white">
            KINGESTION
          </Link>
          <p className="mt-3 max-w-[14rem] text-sm leading-7 text-white/48">
            Kingston RMA control desk. Cases, actions, SLA and traceability in one place.
          </p>
        </div>

        <nav className="mt-10 space-y-2">
          {primaryNavigation.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-[1.15rem] border px-4 py-3 transition ${
                  active
                    ? "border-[rgba(123,214,145,0.32)] bg-[rgba(123,214,145,0.12)] text-white"
                    : "border-transparent bg-transparent text-white/54 hover:border-white/8 hover:bg-white/4 hover:text-white"
                }`}
              >
                <div className="text-sm font-semibold uppercase tracking-[0.16em]">{item.label}</div>
                <div className="mt-1 text-xs leading-6 text-white/42">{item.hint}</div>
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 rounded-[1.4rem] border border-white/10 bg-white/4 px-4 py-4">
          <p className="workspace-kicker">Queues</p>
          <div className="mt-4 space-y-3 text-sm text-white/64">
            <div className="flex items-center justify-between">
              <span>Open cases</span>
              <span className="font-semibold text-white">{snapshot.openCases.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Overdue tasks</span>
              <span className="font-semibold text-white">{snapshot.taskBuckets.overdue.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Pickup ready</span>
              <span className="font-semibold text-white">
                {snapshot.openCases.filter((entry) => entry.externalStatus === "Producto listo para retiro").length}
              </span>
            </div>
          </div>
          <Link href="/cases/new" className="workspace-button mt-5 w-full justify-center">
            New case
          </Link>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="workspace-topbar">
          <div className="workspace-search">
            <span className="text-xs uppercase tracking-[0.16em] text-white/34">Search</span>
            <div className="mt-1 text-sm text-white/68">Case number, Kingston ticket, client, SKU</div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden rounded-full border border-white/10 bg-white/4 px-4 py-2 text-xs uppercase tracking-[0.16em] text-white/56 md:block">
              Separate from Anyx Comercial
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-white">
              {getOwnerInitials("Sofia Mendez")}
            </div>
          </div>
        </header>

        <main className="workspace-content">{children}</main>
      </div>
    </div>
  );
}
