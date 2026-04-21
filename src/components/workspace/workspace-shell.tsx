"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useKingestion } from "@/components/workspace/kingestion-provider";
import { getOwnerInitials } from "@/lib/kingston/helpers";

const SIDEBAR_STORAGE_KEY = "kingestion.sidebar.collapsed";

const navigationItems = [
  {
    href: "/dashboard",
    label: "Resumen",
    shortLabel: "RS",
    hint: "Pantallazo general de la operacion"
  },
  {
    href: "/cases",
    label: "Casos abiertos",
    shortLabel: "CA",
    hint: "Bandeja operativa simple"
  },
  {
    href: "/reimbursements",
    label: "Reintegros",
    shortLabel: "RE",
    hint: "Pendientes con comprobantes y cierre"
  },
  {
    href: "/closed-cases",
    label: "Casos cerrados",
    shortLabel: "CC",
    hint: "Archivo de realizados y cerrados"
  },
  {
    href: "/reports",
    label: "Reportes",
    shortLabel: "RP",
    hint: "Consultas y exportes PDF"
  },
  {
    href: "/settings",
    label: "Configuracion",
    shortLabel: "CF",
    hint: "Responsables, asignaciones y auditoria"
  }
];

function isActive(pathname: string, href: string) {
  if (href === "/cases") {
    return pathname === "/cases" || pathname.startsWith("/cases/");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const {
    activeOwner,
    activeOwners,
    dashboardSnapshot,
    themeMode,
    setThemeMode,
    setActiveOwner
  } = useKingestion();

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      setIsSidebarCollapsed(saved === "true");
    } catch {
      setIsSidebarCollapsed(false);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  return (
    <div className={`workspace-shell ${isSidebarCollapsed ? "workspace-shell-collapsed" : ""}`}>
      <aside className="workspace-sidebar">
        <div className="space-y-6">
          <div className="workspace-sidebar-header">
            <div className="space-y-3">
              <Link
                href="/dashboard"
                className={`workspace-brand ${isSidebarCollapsed ? "workspace-brand-collapsed" : ""}`}
              >
                {isSidebarCollapsed ? (
                  <span className="workspace-brand-mini">KG</span>
                ) : (
                  <img
                    src="/kingston-rma-logo.svg"
                    alt="Kingston RMA"
                    className="workspace-brand-logo"
                  />
                )}
              </Link>
              {!isSidebarCollapsed ? (
                <p className="text-sm leading-6 text-white/55">
                  Gestion interna de RMA Kingston para ANYX. Separada de Anyx Comercial.
                </p>
              ) : null}
            </div>

            <button
              type="button"
              className="workspace-sidebar-toggle"
              onClick={() => setIsSidebarCollapsed((current) => !current)}
              aria-label={isSidebarCollapsed ? "Expandir barra lateral" : "Minimizar barra lateral"}
              title={isSidebarCollapsed ? "Expandir barra lateral" : "Minimizar barra lateral"}
            >
              {isSidebarCollapsed ? ">" : "<"}
            </button>
          </div>

          <nav className="space-y-2" aria-label="Modulos principales">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`workspace-nav-link ${isActive(pathname, item.href) ? "workspace-nav-link-active" : ""} ${
                  isSidebarCollapsed ? "workspace-nav-link-collapsed" : ""
                }`}
                aria-label={item.label}
                title={item.label}
              >
                <span className="workspace-nav-link-label">
                  {isSidebarCollapsed ? item.shortLabel : item.label}
                </span>
                {!isSidebarCollapsed ? <span className="workspace-nav-link-hint">{item.hint}</span> : null}
              </Link>
            ))}
          </nav>
        </div>

        <div className="workspace-sidebar-footer">
          {!isSidebarCollapsed ? (
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
          ) : null}

          <div className="workspace-sidebar-controls">
            <div className="workspace-theme-switcher">
              {!isSidebarCollapsed ? <div className="workspace-topbar-label">Modo</div> : null}
              <div className="workspace-theme-buttons">
                <button
                  type="button"
                  className={`workspace-theme-button ${themeMode === "light" ? "workspace-theme-button-active" : ""}`}
                  onClick={() => setThemeMode("light")}
                  aria-label="Modo claro"
                  title="Modo claro"
                >
                  {isSidebarCollapsed ? "CL" : "Claro"}
                </button>
                <button
                  type="button"
                  className={`workspace-theme-button ${themeMode === "dark" ? "workspace-theme-button-active" : ""}`}
                  onClick={() => setThemeMode("dark")}
                  aria-label="Modo oscuro"
                  title="Modo oscuro"
                >
                  {isSidebarCollapsed ? "OS" : "Oscuro"}
                </button>
              </div>
            </div>

            <div className={`workspace-sidebar-session ${isSidebarCollapsed ? "workspace-sidebar-session-collapsed" : ""}`}>
              <div className="workspace-user-badge">{getOwnerInitials(activeOwner?.name ?? "Sin sesion")}</div>
              {!isSidebarCollapsed ? (
                <div className="workspace-inline-form">
                  <label className="workspace-label">
                    <span>Usuario activo</span>
                    <select
                      className="workspace-select"
                      value={activeOwner?.id ?? activeOwners[0]?.id ?? ""}
                      onChange={(event) => setActiveOwner(event.target.value)}
                    >
                      {activeOwners.map((owner) => (
                        <option key={owner.id} value={owner.id}>
                          {owner.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </aside>

      <div className="workspace-main">
        <main className="workspace-content">{children}</main>
      </div>
    </div>
  );
}
