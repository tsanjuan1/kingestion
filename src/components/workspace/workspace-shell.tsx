"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useKingestion } from "@/components/workspace/kingestion-provider";
import { getOwnerInitials, getRoleLabel } from "@/lib/kingston/helpers";
import type { ModulePermissionKey } from "@/lib/kingston/types";

const SIDEBAR_STORAGE_KEY = "kingestion.sidebar.collapsed";
const brandLogo = "/kingestion-logo.png?v=20260422";
const brandMark = "/kingestion-mark.png?v=20260422";

const navigationItems = [
  {
    moduleKey: "summary" as ModulePermissionKey,
    href: "/dashboard",
    label: "Resumen",
    shortLabel: "RS",
    hint: "Pantallazo general de la operacion"
  },
  {
    moduleKey: "open-cases" as ModulePermissionKey,
    href: "/cases",
    label: "Casos abiertos",
    shortLabel: "CA",
    hint: "Bandeja operativa simple"
  },
  {
    moduleKey: "reimbursements" as ModulePermissionKey,
    href: "/reimbursements",
    label: "Reintegros",
    shortLabel: "RE",
    hint: "Pendientes con comprobantes y cierre"
  },
  {
    moduleKey: "pending-purchases" as ModulePermissionKey,
    href: "/pending-purchases",
    label: "Pendientes compras",
    shortLabel: "PC",
    hint: "Casos tomados por compras"
  },
  {
    moduleKey: "pending-service" as ModulePermissionKey,
    href: "/pending-service",
    label: "Pendientes servicio tecnico",
    shortLabel: "ST",
    hint: "Casos en manos del servicio tecnico"
  },
  {
    moduleKey: "closed-cases" as ModulePermissionKey,
    href: "/closed-cases",
    label: "Casos cerrados",
    shortLabel: "CC",
    hint: "Archivo de realizados y cerrados"
  },
  {
    moduleKey: "reports" as ModulePermissionKey,
    href: "/reports",
    label: "Reportes",
    shortLabel: "RP",
    hint: "Consultas y exportes PDF"
  },
  {
    moduleKey: "settings" as ModulePermissionKey,
    href: "/settings",
    label: "Configuracion",
    shortLabel: "CFG",
    hint: "Usuarios, permisos y auditoria"
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
  const router = useRouter();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const {
    activeOwner,
    canAccessModule,
    dashboardSnapshot,
    themeMode,
    setThemeMode
  } = useKingestion();
  const visibleNavigation = navigationItems.filter((item) => canAccessModule(item.moduleKey));

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

  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include"
    });
    router.push("/login");
    router.refresh();
  };

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
                  <img
                    src={brandMark}
                    alt="Kingestion"
                    className="workspace-brand-mini-logo"
                  />
                ) : (
                  <img
                    src={brandLogo}
                    alt="Kingestion"
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
            {visibleNavigation.map((item) => (
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
                  <span>Pedido Kingston</span>
                  <strong className="text-white">
                    {dashboardSnapshot.openCases.filter((entry) => entry.externalStatus === "Pedido Kingston").length}
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
                <div className="space-y-3">
                  <div className="workspace-sidebar-session-copy">
                    <div className="workspace-topbar-label">Usuario activo</div>
                    <div className="text-sm font-semibold text-white">{activeOwner.name}</div>
                    <div className="text-xs uppercase tracking-[0.16em] text-white/42">
                      {getRoleLabel(activeOwner.team)}
                    </div>
                  </div>
                  <button className="workspace-button-secondary w-full justify-center" type="button" onClick={handleLogout}>
                    Cerrar sesion
                  </button>
                </div>
              ) : (
                <button
                  className="workspace-sidebar-icon-button"
                  type="button"
                  onClick={handleLogout}
                  aria-label="Cerrar sesion"
                  title="Cerrar sesion"
                >
                  Salir
                </button>
              )}
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
