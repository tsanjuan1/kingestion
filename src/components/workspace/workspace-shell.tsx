"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { useKingestion } from "@/components/workspace/kingestion-provider";
import { getOwnerInitials } from "@/lib/kingston/helpers";

const navigationItems = [
  { href: "/dashboard", label: "Resumen", hint: "Pantallazo general de la operacion" },
  { href: "/cases", label: "Casos abiertos", hint: "Seguimiento y avance por etapas" },
  { href: "/closed-cases", label: "Casos cerrados", hint: "Realizados y cerrados" },
  { href: "/reports", label: "Reportes", hint: "Consultas y exportes PDF" },
  { href: "/settings", label: "Configuracion", hint: "Responsables, asignaciones y auditoria" }
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
  if (pathname.startsWith("/cases")) return "Casos abiertos";
  if (pathname.startsWith("/closed-cases")) return "Casos cerrados";
  if (pathname.startsWith("/reports")) return "Reportes";
  if (pathname.startsWith("/settings")) return "Configuracion";
  if (pathname.startsWith("/login")) return "Acceso";

  return "Resumen";
}

function getSearchAction(pathname: string) {
  if (pathname.startsWith("/closed-cases")) {
    return "/closed-cases";
  }

  return "/cases";
}

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { activeOwner, dashboardSnapshot, themeMode, setThemeMode } = useKingestion();

  return (
    <div className={`workspace-shell theme-${themeMode}`}>
      <aside className="workspace-sidebar">
        <div className="space-y-8">
          <div className="space-y-3">
            <Link href="/dashboard" className="workspace-brand">
              kingestion
            </Link>
            <p className="text-sm leading-6 text-white/55">
              Gestion interna de RMA Kingston para ANYX. Separada de Anyx Comercial.
            </p>
          </div>

          <nav className="space-y-2" aria-label="Modulos principales">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`workspace-nav-link ${isActive(pathname, item.href) ? "workspace-nav-link-active" : ""}`}
              >
                <span className="workspace-nav-link-label">{item.label}</span>
                <span className="workspace-nav-link-hint">{item.hint}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="workspace-sidebar-summary">
          <p className="workspace-kicker">Situacion actual</p>
          <div className="space-y-2.5 text-sm text-white/66">
            <div className="flex items-center justify-between">
              <span>Abiertos</span>
              <strong className="text-white">{dashboardSnapshot.openCases.length}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Cerrados</span>
              <strong className="text-white">{dashboardSnapshot.closedCases.length}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Pedido a Kingston</span>
              <strong className="text-white">
                {dashboardSnapshot.openCases.filter((entry) => entry.externalStatus === "Pedido a Kingston").length}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Tareas vencidas</span>
              <strong className="text-white">{dashboardSnapshot.taskBuckets.overdue.length}</strong>
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
            <WorkspaceSearchForm action={getSearchAction(pathname)} />
          </Suspense>

          <div className="workspace-topbar-controls">
            <div className="workspace-theme-switcher">
              <div className="workspace-topbar-label">Modo</div>
              <div className="workspace-theme-buttons">
                <button
                  type="button"
                  className={`workspace-theme-button ${themeMode === "light" ? "workspace-theme-button-active" : ""}`}
                  onClick={() => setThemeMode("light")}
                >
                  Claro
                </button>
                <button
                  type="button"
                  className={`workspace-theme-button ${themeMode === "dark" ? "workspace-theme-button-active" : ""}`}
                  onClick={() => setThemeMode("dark")}
                >
                  Oscuro
                </button>
              </div>
            </div>

            <Link className="workspace-user" href="/settings?view=responsables">
              <div className="workspace-user-badge">
                {getOwnerInitials(activeOwner?.name ?? "Sin sesion")}
              </div>
              <div className="hidden text-right md:block">
                <div className="workspace-topbar-label">Usuario activo</div>
                <div className="text-sm font-medium text-white">
                  {activeOwner?.name ?? "Sin responsable activo"}
                </div>
              </div>
            </Link>
          </div>
        </header>

        <main className="workspace-content">{children}</main>
      </div>
    </div>
  );
}

function WorkspaceSearchForm({ action }: { action: string }) {
  const searchParams = useSearchParams();
  const currentSearch = searchParams.get("q") ?? "";

  return (
    <form action={action} className="workspace-search-form">
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
