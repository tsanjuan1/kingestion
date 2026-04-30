"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useKingestion } from "@/components/workspace/kingestion-provider";
import { getRoleLabel } from "@/lib/kingston/helpers";
import type { ModulePermissionKey } from "@/lib/kingston/types";

const SIDEBAR_STORAGE_KEY = "kingestion.sidebar.collapsed";
const brandLogo = "/kingestion-logo.png?v=20260422";
const brandMark = "/kingestion-mark.png?v=20260422";

type IconProps = {
  className?: string;
};

function SummaryIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7.5 14.5h2.5V10H7.5zm4.8 0h2.5V8.5h-2.5zm4.8 0h2.5V12h-2.5z" fill="currentColor" />
    </svg>
  );
}

function CasesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <rect x="4" y="5" width="16" height="14" rx="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17.2 8.1l1.2 1.2-2.8 2.8-1.2.1.1-1.2z" fill="currentColor" />
    </svg>
  );
}

function MoneyIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 10h.01M17 14h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function CartIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M5 6h2l1.2 7.2a1.8 1.8 0 0 0 1.8 1.5H17a1.8 1.8 0 0 0 1.8-1.3L20 8H8.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10.5" cy="18" r="1.5" fill="currentColor" />
      <circle cx="17" cy="18" r="1.5" fill="currentColor" />
    </svg>
  );
}

function ServiceIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M14.2 5.2a3.3 3.3 0 1 0 4.6 4.6l1.3 1.3-2.1 2.1a4.7 4.7 0 0 1-6.7 0l-4.5 4.5-2.3-2.3 4.5-4.5a4.7 4.7 0 0 1 0-6.7l2.1-2.1z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArchiveIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <rect x="4" y="5" width="16" height="4.5" rx="1.8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 10.3h12v6.4A2.3 2.3 0 0 1 15.7 19H8.3A2.3 2.3 0 0 1 6 16.7z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 13h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ReportsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M6 18.5V11m6 7.5V6m6 12.5v-4.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 18.5h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 4.5v2.1M12 17.4v2.1M19.5 12h-2.1M6.6 12H4.5M17.3 6.7l-1.5 1.5M8.2 15.8l-1.5 1.5M17.3 17.3l-1.5-1.5M8.2 8.2 6.7 6.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SidebarToggleIcon({ className, collapsed }: IconProps & { collapsed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.35" />
      <path d={collapsed ? "M9.5 12h6m-2.4-2.4 2.4 2.4-2.4 2.4" : "M14.5 12h-6m2.4-2.4-2.4 2.4 2.4 2.4"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SunIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="3.3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 4.5v2M12 17.5v2M19.5 12h-2M6.5 12h-2M17.3 6.7l-1.5 1.5M8.2 15.8l-1.5 1.5M17.3 17.3l-1.5-1.5M8.2 8.2 6.7 6.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M15.6 4.8a7.7 7.7 0 1 0 3.6 14.5 8.5 8.5 0 0 1-6.2-8.2 8.4 8.4 0 0 1 2.6-6.3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function UserIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6.4 18.4a5.9 5.9 0 0 1 11.2 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function LogoutIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M10 5.5H7.8A1.8 1.8 0 0 0 6 7.3v9.4a1.8 1.8 0 0 0 1.8 1.8H10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M13 9.2 16.2 12 13 14.8M16 12H9.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const navigationItems = [
  {
    moduleKey: "summary" as ModulePermissionKey,
    href: "/dashboard",
    label: "Resumen",
    icon: SummaryIcon,
    hint: "Pantallazo general de la operacion"
  },
  {
    moduleKey: "open-cases" as ModulePermissionKey,
    href: "/cases",
    label: "Casos abiertos",
    icon: CasesIcon,
    hint: "Bandeja operativa simple"
  },
  {
    moduleKey: "reimbursements" as ModulePermissionKey,
    href: "/reimbursements",
    label: "Reintegros",
    icon: MoneyIcon,
    hint: "Pendientes con comprobantes y cierre"
  },
  {
    moduleKey: "pending-purchases" as ModulePermissionKey,
    href: "/pending-purchases",
    label: "Pendientes compras",
    icon: CartIcon,
    hint: "Casos tomados por compras"
  },
  {
    moduleKey: "pending-service" as ModulePermissionKey,
    href: "/pending-service",
    label: "Pendientes servicio tecnico",
    icon: ServiceIcon,
    hint: "Casos en manos del servicio tecnico"
  },
  {
    moduleKey: "closed-cases" as ModulePermissionKey,
    href: "/closed-cases",
    label: "Casos cerrados",
    icon: ArchiveIcon,
    hint: "Archivo de realizados y cerrados"
  },
  {
    moduleKey: "reports" as ModulePermissionKey,
    href: "/reports",
    label: "Reportes",
    icon: ReportsIcon,
    hint: "Consultas y exportes PDF"
  },
  {
    moduleKey: "settings" as ModulePermissionKey,
    href: "/settings",
    label: "Configuracion",
    icon: SettingsIcon,
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
        <div className="workspace-sidebar-frame">
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
              <SidebarToggleIcon className="workspace-sidebar-toggle-icon" collapsed={isSidebarCollapsed} />
            </button>
          </div>

          <nav className="space-y-2" aria-label="Modulos principales">
            {visibleNavigation.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`workspace-nav-link ${isActive(pathname, item.href) ? "workspace-nav-link-active" : ""} ${
                    isSidebarCollapsed ? "workspace-nav-link-collapsed" : ""
                  }`}
                  aria-label={item.label}
                  title={`${item.label} · ${item.hint}`}
                >
                  <span className="workspace-nav-link-icon">
                    <Icon className="workspace-nav-icon-svg" />
                  </span>
                  {!isSidebarCollapsed ? (
                    <span className="workspace-nav-link-copy">
                      <span className="workspace-nav-link-label">{item.label}</span>
                    </span>
                  ) : null}
                </Link>
              );
            })}
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
                    <SunIcon className="workspace-theme-button-icon" />
                    {!isSidebarCollapsed ? "Claro" : null}
                  </button>
                  <button
                    type="button"
                    className={`workspace-theme-button ${themeMode === "dark" ? "workspace-theme-button-active" : ""}`}
                    onClick={() => setThemeMode("dark")}
                    aria-label="Modo oscuro"
                    title="Modo oscuro"
                  >
                    <MoonIcon className="workspace-theme-button-icon" />
                    {!isSidebarCollapsed ? "Oscuro" : null}
                  </button>
                </div>
              </div>

              <div className={`workspace-sidebar-session ${isSidebarCollapsed ? "workspace-sidebar-session-collapsed" : ""}`}>
                <div className="workspace-user-badge">
                  <UserIcon className="workspace-user-icon" />
                </div>
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
                      <LogoutIcon className="workspace-inline-icon" />
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
                    <LogoutIcon className="workspace-inline-icon" />
                  </button>
                )}
              </div>
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
