"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useKingestion } from "@/components/workspace/kingestion-provider";
import { getRoleLabel } from "@/lib/kingston/helpers";
import { isModuleOnboardingId, moduleOnboardingIds, type ModuleOnboardingId } from "@/lib/kingston/onboarding";
import type { ModulePermissionKey } from "@/lib/kingston/types";

const SIDEBAR_STORAGE_KEY = "kingestion.sidebar.collapsed";
const LEGACY_MODULE_ONBOARDING_VERSION = "v1";
const LEGACY_MODULE_ONBOARDING_STORAGE_PREFIX = `kingestion.module-onboarding.${LEGACY_MODULE_ONBOARDING_VERSION}`;
const brandLogo = "/kingestion-logo-v3.svg?v=20260514";
const brandMark = "/kingestion-mark-v3.svg?v=20260514";

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

function MailIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m5.4 8.2 5.3 4.3a2.1 2.1 0 0 0 2.6 0l5.3-4.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.2 14.2h2.2M16.2 16.6h1.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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

function AuditIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M12 4.2 18.5 7v4.5c0 4.1-2.6 7.1-6.5 8.3-3.9-1.2-6.5-4.2-6.5-8.3V7z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
    moduleKey: "mail" as ModulePermissionKey,
    href: "/mail",
    label: "Correo",
    icon: MailIcon,
    hint: "Bandeja en vivo de casos Kingston"
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
    moduleKey: "audit" as ModulePermissionKey,
    href: "/audit",
    label: "Auditoria",
    icon: AuditIcon,
    hint: "Actividad, correos y trazabilidad"
  },
  {
    moduleKey: "settings" as ModulePermissionKey,
    href: "/settings",
    label: "Configuracion",
    icon: SettingsIcon,
    hint: "Usuarios, permisos y automatizacion"
  }
];

type OnboardingModuleId = ModuleOnboardingId;

type ModuleOnboardingCopy = {
  id: OnboardingModuleId;
  eyebrow: string;
  title: string;
  description: string;
  steps: string[];
};

const moduleOnboarding: Record<OnboardingModuleId, ModuleOnboardingCopy> = {
  summary: {
    id: "summary",
    eyebrow: "Resumen",
    title: "Pantallazo de la operacion",
    description: "Este modulo sirve para entender rapido como esta la gestion general sin entrar caso por caso.",
    steps: [
      "Usa los desplegables para ver solo la informacion que necesitas en ese momento.",
      "La vista rapida marca volumen, prioridades y posibles cuellos de botella.",
      "Desde aca podes pasar a busqueda o a los modulos operativos cuando detectes algo para revisar."
    ]
  },
  mail: {
    id: "mail",
    eyebrow: "Correo",
    title: "Bandeja de casos Kingston",
    description: "Aca se refleja la carpeta de correos Kingston y podes revisar mensajes como una casilla interna.",
    steps: [
      "La bandeja se actualiza y dispara la automatizacion nativa cuando corresponde.",
      "Al abrir un mail podes revisar cuerpo, adjuntos y datos principales.",
      "Desde este modulo tambien podes responder manualmente si el caso necesita intervencion humana."
    ]
  },
  "open-cases": {
    id: "open-cases",
    eyebrow: "Casos abiertos",
    title: "Bandeja operativa",
    description: "Aca quedan los casos activos que todavia necesitan seguimiento o accion de algun sector.",
    steps: [
      "La tabla muestra numero, fecha, cliente, SKU, zona y estado.",
      "El estado se cambia desde el desplegable respetando la zona del caso.",
      "Entrando al caso ves cliente, producto, operacion, adjuntos, historial y cambio de etapa."
    ]
  },
  reimbursements: {
    id: "reimbursements",
    eyebrow: "Reintegros",
    title: "Seguimiento de reintegros",
    description: "Este modulo ayuda a controlar casos que requieren reintegro sin sacarlos de casos abiertos.",
    steps: [
      "Los casos aparecen cuando corresponde por zona y estado operativo.",
      "Podes marcar 'Reintegro en proceso' como recordatorio visual intermedio.",
      "Cuando se marca completado, el caso desaparece de esta bandeja de pendientes."
    ]
  },
  "pending-purchases": {
    id: "pending-purchases",
    eyebrow: "Pendientes compras",
    title: "Acciones de compras",
    description: "Aca llegan los casos donde compras debe resolver abastecimiento, pedido Kingston o recepcion.",
    steps: [
      "Cada caso conserva su lugar en abiertos, pero queda destacado para compras.",
      "El boton de completado permite pasar a la siguiente etapa habilitada.",
      "Cuando hay opciones posibles, elegi la continuidad correcta antes de completar."
    ]
  },
  "pending-service": {
    id: "pending-service",
    eyebrow: "Pendientes servicio tecnico",
    title: "Acciones tecnicas",
    description: "Este modulo concentra casos que necesita tomar Servicio Tecnico o deposito.",
    steps: [
      "Sirve para validar recepcion, deposito, etiquetado y salida final.",
      "En casos de Interior/GBA puede quedar pendiente cargar numero de guia.",
      "Si falta una guia, el administrador conserva control manual para corregir estados."
    ]
  },
  "closed-cases": {
    id: "closed-cases",
    eyebrow: "Casos cerrados",
    title: "Archivo operativo",
    description: "Aca se consultan casos realizados, vencidos, cerrados y archivados.",
    steps: [
      "La vista mantiene el mismo criterio simple que casos abiertos.",
      "Los casos archivados se consultan desde este modulo para no mezclar configuracion con operacion.",
      "Solo usuarios autorizados pueden restaurar o revisar informacion sensible."
    ]
  },
  reports: {
    id: "reports",
    eyebrow: "Reportes",
    title: "Analisis y exportaciones",
    description: "Este modulo sirve para consultar indicadores y preparar informacion para seguimiento o gestion.",
    steps: [
      "Podes revisar reportes por estado, cliente, SKU y auditoria segun tus permisos.",
      "Los reportes usan la informacion actual de Kingestion.",
      "Cuando descargues informacion sensible, queda registro en auditoria."
    ]
  },
  audit: {
    id: "audit",
    eyebrow: "Auditoria",
    title: "Trazabilidad de acciones",
    description: "Aca se revisa quien hizo que, a que hora, y que correos automaticos fueron enviados o fallaron.",
    steps: [
      "Actividad muestra interacciones de usuarios y automatizaciones.",
      "Correos muestra cola, envios, reintentos y fallos definitivos.",
      "Este modulo solo aparece para usuarios con permiso otorgado por el administrador."
    ]
  },
  settings: {
    id: "settings",
    eyebrow: "Configuracion",
    title: "Usuarios, permisos y automatizacion",
    description: "Aca el administrador controla responsables, accesos y parametros visuales/operativos.",
    steps: [
      "Usuarios permite crear, editar, desactivar o eliminar responsables.",
      "Permisos define que puede ver o gestionar cada sector.",
      "Automatizacion permite pausar, reanudar o disparar controles cuando sea necesario."
    ]
  },
  "new-case": {
    id: "new-case",
    eyebrow: "Nuevo caso",
    title: "Carga manual de RMA",
    description: "Esta pantalla se usa cuando hay que crear un caso manualmente sin esperar la automatizacion de correo.",
    steps: [
      "Completá los datos principales del cliente, producto, zona y contacto.",
      "Podés adjuntar comprobantes o imagenes si el caso ya trae documentacion.",
      "Al guardar, el caso queda disponible en la bandeja correspondiente."
    ]
  },
  "case-detail": {
    id: "case-detail",
    eyebrow: "Detalle de caso",
    title: "Centro operativo del caso",
    description: "Aca se trabaja el caso completo: datos, adjuntos, responsable, historial y cambio de etapa.",
    steps: [
      "Usa las pestañas para abrir solo la informacion que necesitas.",
      "Historial muestra la cadena de correos y adjuntos vinculados.",
      "Cambio de etapa permite avanzar el flujo respetando zona, permisos y restricciones."
    ]
  },
  profile: {
    id: "profile",
    eyebrow: "Perfil",
    title: "Tu usuario",
    description: "Desde aca cada usuario puede revisar o actualizar sus datos permitidos.",
    steps: [
      "Podés modificar datos personales habilitados.",
      "Tambien podes cambiar tu contraseña cuando lo necesites.",
      "Los permisos de acceso los administra un usuario administrador."
    ]
  },
  search: {
    id: "search",
    eyebrow: "Busqueda",
    title: "Consulta avanzada",
    description: "Esta pantalla sirve para encontrar casos abiertos o cerrados sin recargar las bandejas operativas.",
    steps: [
      "Combina texto, estado, zona y responsable para ubicar un caso.",
      "Es util cuando no sabes si el caso esta abierto, cerrado o archivado.",
      "Desde los resultados podes entrar al detalle si tenes permisos."
    ]
  },
  tasks: {
    id: "tasks",
    eyebrow: "Tareas",
    title: "Pendientes personales",
    description: "Aca se agrupan tareas asociadas a casos y proximas acciones.",
    steps: [
      "Sirve para detectar tareas vencidas, proximas o bloqueadas.",
      "Cada tarea mantiene referencia al caso que la origino.",
      "La prioridad ayuda a ordenar la atencion diaria."
    ]
  },
  workflow: {
    id: "workflow",
    eyebrow: "Workflow",
    title: "Reglas del circuito",
    description: "Esta vista documenta estados, subestados y transiciones disponibles.",
    steps: [
      "Los estados dependen de la zona del caso.",
      "Las transiciones muestran el orden operativo previsto.",
      "Es una referencia para entender por que cada modulo recibe ciertos casos."
    ]
  }
};

function isActive(pathname: string, href: string) {
  if (href === "/cases") {
    return pathname === "/cases" || pathname.startsWith("/cases/");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getOnboardingModuleId(pathname: string): OnboardingModuleId | null {
  if (pathname === "/dashboard") return "summary";
  if (pathname === "/mail") return "mail";
  if (pathname === "/cases/new") return "new-case";
  if (/^\/cases\/[^/]+/.test(pathname)) return "case-detail";
  if (pathname === "/cases") return "open-cases";
  if (pathname === "/reimbursements") return "reimbursements";
  if (pathname === "/pending-purchases") return "pending-purchases";
  if (pathname === "/pending-service") return "pending-service";
  if (pathname === "/closed-cases") return "closed-cases";
  if (pathname === "/reports") return "reports";
  if (pathname === "/audit") return "audit";
  if (pathname === "/settings" || pathname === "/admin") return "settings";
  if (pathname.startsWith("/admin/workflow")) return "workflow";
  if (pathname === "/profile") return "profile";
  if (pathname === "/search") return "search";
  if (pathname === "/tasks") return "tasks";
  return null;
}

function getLegacyOnboardingStorageKey(userId: string, moduleId: OnboardingModuleId) {
  return `${LEGACY_MODULE_ONBOARDING_STORAGE_PREFIX}.${userId}.${moduleId}`;
}

function getLegacySeenOnboardingModules(userId: string): OnboardingModuleId[] {
  try {
    return moduleOnboardingIds.filter((moduleId) => {
      return window.localStorage.getItem(getLegacyOnboardingStorageKey(userId, moduleId)) === "done";
    });
  } catch {
    return [];
  }
}

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeOnboarding, setActiveOnboarding] = useState<ModuleOnboardingCopy | null>(null);
  const [seenOnboardingModules, setSeenOnboardingModules] = useState<Set<OnboardingModuleId> | null>(null);
  const [isSavingOnboarding, setIsSavingOnboarding] = useState(false);
  const [onboardingSaveError, setOnboardingSaveError] = useState<string | null>(null);
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

  useEffect(() => {
    let cancelled = false;

    async function loadSeenOnboardingModules() {
      setActiveOnboarding(null);
      setSeenOnboardingModules(null);
      setOnboardingSaveError(null);

      try {
        const response = await fetch("/api/profile/module-onboarding", {
          method: "GET",
          credentials: "include",
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("No se pudo leer el instructivo visto del usuario.");
        }

        const data = (await response.json()) as { seenModules?: unknown[] };
        const cloudSeenModules = (data.seenModules ?? []).filter(isModuleOnboardingId);
        const legacySeenModules = getLegacySeenOnboardingModules(activeOwner.id);
        const mergedSeenModules = Array.from(new Set([...cloudSeenModules, ...legacySeenModules]));

        if (!cancelled) {
          setSeenOnboardingModules(new Set(mergedSeenModules));
        }

        const legacyModulesToSync = legacySeenModules.filter((moduleId) => !cloudSeenModules.includes(moduleId));
        if (legacyModulesToSync.length > 0) {
          await fetch("/api/profile/module-onboarding", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ moduleIds: legacyModulesToSync })
          });
        }
      } catch {
        if (!cancelled) {
          // Si no se puede consultar la nube, preferimos no mostrar ayuda repetida por error de red.
          setSeenOnboardingModules(new Set(moduleOnboardingIds));
        }
      }
    }

    void loadSeenOnboardingModules();

    return () => {
      cancelled = true;
    };
  }, [activeOwner.id]);

  useEffect(() => {
    const moduleId = getOnboardingModuleId(pathname);
    setOnboardingSaveError(null);

    if (!moduleId || !seenOnboardingModules) {
      setActiveOnboarding(null);
      return;
    }

    setActiveOnboarding(seenOnboardingModules.has(moduleId) ? null : moduleOnboarding[moduleId]);
  }, [pathname, seenOnboardingModules]);

  const handleContinueOnboarding = async () => {
    if (!activeOnboarding) return;

    try {
      setIsSavingOnboarding(true);
      setOnboardingSaveError(null);

      const moduleId = activeOnboarding.id;
      const response = await fetch("/api/profile/module-onboarding", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId })
      });

      if (!response.ok) {
        throw new Error("No se pudo guardar el instructivo visto.");
      }

      setSeenOnboardingModules((currentModules) => {
        const nextModules = new Set(currentModules ?? []);
        nextModules.add(moduleId);
        return nextModules;
      });
      setActiveOnboarding(null);
    } catch {
      setOnboardingSaveError("No pude guardar este paso. Probá nuevamente para que no vuelva a mostrarse.");
    } finally {
      setIsSavingOnboarding(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include"
    });
    router.push("/login");
    router.refresh();
  };

  const nextThemeMode = themeMode === "light" ? "dark" : "light";
  const nextThemeLabel = nextThemeMode === "light" ? "Claro" : "Oscuro";

  return (
    <div className={`workspace-shell ${isSidebarCollapsed ? "workspace-shell-collapsed" : ""}`}>
      <aside className="workspace-sidebar">
        <div className="workspace-sidebar-frame">
          <div className="space-y-6">
          <div className="workspace-sidebar-header">
            <div className="space-y-3">
              <Link
                href="/dashboard"
                prefetch={false}
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
                  Gestion interna de RMA Kingston para ANYX.
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
                  prefetch={false}
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
                <div className="mt-3 space-y-2.5 text-sm text-white/66">
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
                <button
                  type="button"
                  className="workspace-theme-toggle"
                  onClick={() => setThemeMode(nextThemeMode)}
                  aria-label={`Cambiar a modo ${nextThemeLabel.toLowerCase()}`}
                  title={`Cambiar a modo ${nextThemeLabel.toLowerCase()}`}
                >
                  {nextThemeMode === "dark" ? (
                    <MoonIcon className="workspace-theme-toggle-icon" />
                  ) : (
                    <SunIcon className="workspace-theme-toggle-icon" />
                  )}
                  {!isSidebarCollapsed ? nextThemeLabel : null}
                </button>
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
                    <Link className="workspace-button-secondary w-full justify-center" href="/profile" prefetch={false}>
                      <UserIcon className="workspace-inline-icon" />
                      Perfil
                    </Link>
                    <button className="workspace-button-secondary w-full justify-center" type="button" onClick={handleLogout}>
                      <LogoutIcon className="workspace-inline-icon" />
                      Cerrar sesion
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Link
                      className="workspace-sidebar-icon-button"
                      href="/profile"
                      prefetch={false}
                      aria-label="Perfil"
                      title="Perfil"
                    >
                      <UserIcon className="workspace-inline-icon" />
                    </Link>
                    <button
                      className="workspace-sidebar-icon-button"
                      type="button"
                      onClick={handleLogout}
                      aria-label="Cerrar sesion"
                      title="Cerrar sesion"
                    >
                      <LogoutIcon className="workspace-inline-icon" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="workspace-main">
        <main className="workspace-content">{children}</main>
      </div>

      {activeOnboarding ? (
        <div className="workspace-onboarding-overlay" role="presentation">
          <section
            className="workspace-onboarding-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-onboarding-title"
            aria-describedby="workspace-onboarding-description"
          >
            <div className="workspace-onboarding-orb" aria-hidden="true" />
            <p className="workspace-kicker">{activeOnboarding.eyebrow}</p>
            <h2 id="workspace-onboarding-title" className="workspace-onboarding-title">
              {activeOnboarding.title}
            </h2>
            <p id="workspace-onboarding-description" className="workspace-onboarding-description">
              {activeOnboarding.description}
            </p>

            <div className="workspace-onboarding-steps">
              {activeOnboarding.steps.map((step, index) => (
                <div className="workspace-onboarding-step" key={step}>
                  <span className="workspace-onboarding-step-number">{index + 1}</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>

            <div className="workspace-onboarding-footer">
              <span>Esta ayuda se muestra una sola vez por usuario y modulo, en cualquier equipo.</span>
              {onboardingSaveError ? <span className="workspace-onboarding-error">{onboardingSaveError}</span> : null}
              <button
                className="workspace-button"
                type="button"
                onClick={handleContinueOnboarding}
                disabled={isSavingOnboarding}
              >
                {isSavingOnboarding ? "Guardando..." : "Continuar, entendido"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
