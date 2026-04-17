"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { getDashboardSnapshot, getOwnerInitials } from "@/lib/kingston/helpers";

const navigationGroups = [
  {
    title: "Inicio",
    items: [{ href: "/dashboard", label: "Resumen", hint: "Estado general y prioridades" }]
  },
  {
    title: "Casos",
    items: [
      { href: "/cases", label: "Bandeja", hint: "Casos abiertos y filtros" },
      { href: "/cases/new", label: "Nuevo caso", hint: "Alta y vista previa" }
    ]
  },
  {
    title: "Operacion",
    items: [
      { href: "/tasks", label: "Tareas", hint: "Vencimientos y responsables" },
      { href: "/reports", label: "Reportes", hint: "Aging y volumen" }
    ]
  },
  {
    title: "Configuracion",
    items: [{ href: "/admin/workflow", label: "Flujo", hint: "Estados y reglas" }]
  }
];

function isActive(pathname: string, href: string) {
  if (href === "/cases") {
    return pathname === "/cases" || pathname.startsWith("/cases/");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getPageLabel(pathname: string) {
  if (pathname.startsWith("/cases/new")) return "Nuevo caso";
  if (pathname.startsWith("/cases/")) return "Detalle del caso";
  if (pathname.startsWith("/cases")) return "Bandeja de casos";
  if (pathname.startsWith("/tasks")) return "Tareas";
  if (pathname.startsWith("/reports")) return "Reportes";
  if (pathname.startsWith("/admin/workflow")) return "Flujo";
  if (pathname.startsWith("/login")) return "Acceso";

  return "Resumen";
}

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const snapshot = getDashboardSnapshot();

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <div className="space-y-8">
          <div className="space-y-3">
            <Link href="/dashboard" className="workspace-brand">
              kingestion
            </Link>
            <p className="text-sm leading-6 text-white/55">
              Gestion interna de casos Kingston para ANYX. Separada de Anyx Comercial.
            </p>
          </div>

          <nav className="space-y-6">
            {navigationGroups.map((group) => (
              <div key={group.title} className="space-y-2">
                <div className="workspace-nav-group-title">{group.title}</div>
                <div className="space-y-1.5">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`workspace-nav-link ${isActive(pathname, item.href) ? "workspace-nav-link-active" : ""}`}
                    >
                      <span className="workspace-nav-link-label">{item.label}</span>
                      <span className="workspace-nav-link-hint">{item.hint}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="workspace-sidebar-summary">
          <p className="workspace-kicker">Hoy</p>
          <div className="space-y-2.5 text-sm text-white/66">
            <div className="flex items-center justify-between">
              <span>Casos abiertos</span>
              <strong className="text-white">{snapshot.openCases.length}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Tareas vencidas</span>
              <strong className="text-white">{snapshot.taskBuckets.overdue.length}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Listos para retiro</span>
              <strong className="text-white">
                {snapshot.openCases.filter((entry) => entry.externalStatus === "Producto listo para retiro").length}
              </strong>
            </div>
          </div>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="workspace-topbar">
          <div className="space-y-1">
            <div className="workspace-topbar-label">Modulo actual</div>
            <div className="text-lg font-semibold text-white">{getPageLabel(pathname)}</div>
          </div>

          <Suspense fallback={<WorkspaceSearchFallback />}>
            <WorkspaceSearchForm />
          </Suspense>

          <div className="workspace-user">
            <div className="workspace-user-badge">{getOwnerInitials("Sofia Mendez")}</div>
            <div className="hidden text-right md:block">
              <div className="workspace-topbar-label">Sesion</div>
              <div className="text-sm font-medium text-white">Operacion ANYX</div>
            </div>
          </div>
        </header>

        <main className="workspace-content">{children}</main>
      </div>
    </div>
  );
}

function WorkspaceSearchForm() {
  const searchParams = useSearchParams();
  const currentSearch = searchParams.get("q") ?? "";

  return (
    <form action="/cases" className="workspace-search-form">
      <label htmlFor="workspace-search" className="workspace-topbar-label">
        Buscar caso
      </label>
      <div className="workspace-search-row">
        <input
          id="workspace-search"
          name="q"
          defaultValue={currentSearch}
          className="workspace-search-input"
          placeholder="Numero, ticket Kingston, cliente o SKU"
        />
        <button className="workspace-button" type="submit">
          Buscar
        </button>
      </div>
    </form>
  );
}

function WorkspaceSearchFallback() {
  return (
    <div className="workspace-search-form">
      <div className="workspace-topbar-label">Buscar caso</div>
      <div className="workspace-search-row">
        <input className="workspace-search-input" placeholder="Numero, ticket Kingston, cliente o SKU" />
        <button className="workspace-button" type="button">
          Buscar
        </button>
      </div>
    </div>
  );
}
