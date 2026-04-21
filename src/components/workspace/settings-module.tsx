"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { modulePermissionKeys, transitionRules, workflowStates } from "@/lib/kingston/data";
import { getDefaultPermissionsForRole } from "@/lib/kingston/data";
import { ModuleSubnav } from "@/components/workspace/module-subnav";
import { SectionPanel } from "@/components/workspace/section-panel";
import { useKingestion } from "@/components/workspace/kingestion-provider";
import {
  formatDateTime,
  getAuditActionLabel,
  getRoleLabel,
  getWorkflowCategoryLabel
} from "@/lib/kingston/helpers";
import type { ModulePermissionKey, ModulePermissions, OwnerDirectoryEntry } from "@/lib/kingston/types";

type SettingsView = "usuarios" | "asignaciones" | "auditoria" | "workflow";

type OwnerFormState = {
  name: string;
  email: string;
  team: OwnerDirectoryEntry["team"];
  active: boolean;
  password: string;
  permissions: ModulePermissions;
};

const emptyOwnerForm: OwnerFormState = {
  name: "",
  email: "",
  team: "SALES",
  active: true,
  password: "",
  permissions: getDefaultPermissionsForRole("SALES")
};

function getView(value: string | null): SettingsView {
  switch (value) {
    case "asignaciones":
    case "auditoria":
    case "workflow":
      return value;
    default:
      return "usuarios";
  }
}

function getModuleLabel(moduleKey: ModulePermissionKey) {
  switch (moduleKey) {
    case "summary":
      return "Resumen";
    case "open-cases":
      return "Casos abiertos";
    case "reimbursements":
      return "Reintegros";
    case "pending-purchases":
      return "Pendientes compras";
    case "pending-service":
      return "Pendientes servicio tecnico";
    case "closed-cases":
      return "Casos cerrados";
    case "reports":
      return "Reportes";
    case "settings":
      return "Configuracion";
    default:
      return moduleKey;
  }
}

export function SettingsModule() {
  const searchParams = useSearchParams();
  const view = getView(searchParams.get("view"));
  const {
    owners,
    activeOwners,
    openCases,
    auditLog,
    activeOwner,
    canManageModule,
    createOwner,
    updateOwner,
    deleteOwner,
    assignCaseOwner
  } = useKingestion();
  const canManageSettings = canManageModule("settings");
  const [editingOwnerId, setEditingOwnerId] = useState<string | null>(null);
  const [formState, setFormState] = useState<OwnerFormState>(emptyOwnerForm);

  const sortedOwners = useMemo(
    () => [...owners].sort((left, right) => left.name.localeCompare(right.name, "es")),
    [owners]
  );

  const resetForm = () => {
    setEditingOwnerId(null);
    setFormState(emptyOwnerForm);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formState.name.trim() || !formState.email.trim()) {
      return;
    }

    if (!editingOwnerId && formState.password.trim().length < 8) {
      return;
    }

    const input = {
      ...formState,
      permissions: formState.team === "ADMIN" ? getDefaultPermissionsForRole("ADMIN") : formState.permissions
    };

    const success = editingOwnerId ? await updateOwner(editingOwnerId, input) : await createOwner(input);

    if (success) {
      resetForm();
    }
  };

  const startEditing = (owner: OwnerDirectoryEntry) => {
    setEditingOwnerId(owner.id);
    setFormState({
      name: owner.name,
      email: owner.email,
      team: owner.team,
      active: owner.active,
      password: "",
      permissions: owner.permissions
    });
  };

  const updatePermission = (moduleKey: ModulePermissionKey, field: "view" | "manage", value: boolean) => {
    setFormState((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        [moduleKey]: {
          view: field === "view" ? value : value ? true : current.permissions[moduleKey].view,
          manage: field === "manage" ? value : value ? current.permissions[moduleKey].manage : false
        }
      }
    }));
  };

  if (!canManageSettings && view === "usuarios") {
    return (
      <div className="workspace-page">
        <SectionPanel title="Sin permisos" description="Solo el administrador puede gestionar usuarios y permisos.">
          <div className="workspace-empty">
            Sesion actual: {activeOwner.name}. Si necesitas acceso a esta vista, pediselo al administrador.
          </div>
        </SectionPanel>
      </div>
    );
  }

  return (
    <div className="workspace-page">
      <ModuleSubnav
        items={[
          { href: "/settings?view=usuarios", label: "Usuarios", active: view === "usuarios" },
          { href: "/settings?view=asignaciones", label: "Asignaciones", active: view === "asignaciones" },
          { href: "/settings?view=auditoria", label: "Auditoria", active: view === "auditoria" },
          { href: "/settings?view=workflow", label: "Workflow", active: view === "workflow" }
        ]}
      />

      {view === "usuarios" ? (
        <div className="workspace-grid-2">
          <SectionPanel
            title={editingOwnerId ? "Editar usuario" : "Nuevo usuario"}
            description="Alta y mantenimiento de credenciales, sector y permisos por modulo."
          >
            <form className="workspace-inline-form" onSubmit={handleSubmit}>
              <label className="workspace-label">
                <span>Nombre</span>
                <input
                  className="workspace-input"
                  value={formState.name}
                  onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                />
              </label>

              <label className="workspace-label">
                <span>Email</span>
                <input
                  className="workspace-input"
                  value={formState.email}
                  onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
                />
              </label>

              <label className="workspace-label">
                <span>Sector</span>
                <select
                  className="workspace-select"
                  value={formState.team}
                  onChange={(event) => {
                    const nextTeam = event.target.value as OwnerDirectoryEntry["team"];
                    setFormState((current) => ({
                      ...current,
                      team: nextTeam,
                      permissions: getDefaultPermissionsForRole(nextTeam)
                    }));
                  }}
                >
                  <option value="ADMIN">Administrador</option>
                  <option value="SALES">Ventas</option>
                  <option value="TECHNICAL_SERVICE">Servicio tecnico</option>
                  <option value="PURCHASING">Compras</option>
                  <option value="PAYMENTS">Pagos</option>
                </select>
              </label>

              <label className="workspace-label">
                <span>Estado</span>
                <select
                  className="workspace-select"
                  value={formState.active ? "active" : "inactive"}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      active: event.target.value === "active"
                    }))
                  }
                >
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                </select>
              </label>

              <label className="workspace-label">
                <span>{editingOwnerId ? "Nueva contrasena (opcional)" : "Contrasena inicial"}</span>
                <input
                  className="workspace-input"
                  type="password"
                  value={formState.password}
                  onChange={(event) => setFormState((current) => ({ ...current, password: event.target.value }))}
                />
              </label>

              <div className="workspace-permissions-panel">
                <div className="workspace-kicker">Permisos por modulo</div>
                <div className="space-y-3">
                  {modulePermissionKeys.map((moduleKey) => (
                    <div key={moduleKey} className="workspace-permission-row">
                      <div>
                        <div className="text-sm font-semibold text-white">{getModuleLabel(moduleKey)}</div>
                        <div className="text-xs text-white/48">
                          {moduleKey === "settings" ? "Gestion de usuarios, permisos y auditoria." : "Acceso al modulo."}
                        </div>
                      </div>

                      <div className="workspace-inline-actions">
                        <label className="workspace-inline-checkbox">
                          <input
                            type="checkbox"
                            checked={formState.team === "ADMIN" ? true : formState.permissions[moduleKey].view}
                            disabled={formState.team === "ADMIN"}
                            onChange={(event) => updatePermission(moduleKey, "view", event.target.checked)}
                          />
                          <span>Ver</span>
                        </label>
                        <label className="workspace-inline-checkbox">
                          <input
                            type="checkbox"
                            checked={formState.team === "ADMIN" ? true : formState.permissions[moduleKey].manage}
                            disabled={formState.team === "ADMIN"}
                            onChange={(event) => updatePermission(moduleKey, "manage", event.target.checked)}
                          />
                          <span>Administrar</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="workspace-inline-actions">
                <button className="workspace-button" type="submit">
                  {editingOwnerId ? "Guardar cambios" : "Crear usuario"}
                </button>
                {editingOwnerId ? (
                  <button className="workspace-button-secondary" type="button" onClick={resetForm}>
                    Cancelar
                  </button>
                ) : null}
              </div>
            </form>
          </SectionPanel>

          <SectionPanel title="Usuarios existentes" description="Usuarios editables, activables o eliminables por el administrador.">
            <div className="workspace-table-wrap">
              <table className="workspace-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Sector</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedOwners.map((owner) => (
                    <tr key={owner.id}>
                      <td>
                        <div className="font-medium text-white">{owner.name}</div>
                        <div className="workspace-case-meta">{owner.email}</div>
                      </td>
                      <td>{getRoleLabel(owner.team)}</td>
                      <td>{owner.active ? "Activo" : "Inactivo"}</td>
                      <td>
                        <div className="workspace-inline-actions">
                          <button className="workspace-link-button" type="button" onClick={() => startEditing(owner)}>
                            Editar
                          </button>
                          <button
                            className="workspace-link-button workspace-link-button-danger"
                            type="button"
                            disabled={owner.id === activeOwner.id}
                            onClick={async () => {
                              if (window.confirm(`Se va a eliminar a ${owner.name}. Continuar?`)) {
                                const removed = await deleteOwner(owner.id);
                                if (removed && editingOwnerId === owner.id) {
                                  resetForm();
                                }
                              }
                            }}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionPanel>
        </div>
      ) : null}

      {view === "asignaciones" ? (
        <SectionPanel title="Asignacion de casos abiertos" description="Reasigna responsables y deja trazabilidad automaticamente.">
          <div className="workspace-table-wrap">
            <table className="workspace-table">
              <thead>
                <tr>
                  <th>Caso</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Responsable actual</th>
                  <th>Nuevo responsable</th>
                </tr>
              </thead>
              <tbody>
                {openCases.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <div className="font-medium text-white">{entry.internalNumber}</div>
                      <div className="workspace-case-meta">{entry.kingstonNumber}</div>
                    </td>
                    <td>{entry.clientName}</td>
                    <td>{entry.externalStatus}</td>
                    <td>{entry.owner}</td>
                    <td>
                      <select
                        className="workspace-select"
                        value={entry.owner}
                        onChange={(event) => assignCaseOwner(entry.id, event.target.value)}
                      >
                        {activeOwners.map((owner) => (
                          <option key={owner.id} value={owner.name}>
                            {owner.name}
                          </option>
                        ))}
                        <option value="Sin asignar">Sin asignar</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionPanel>
      ) : null}

      {view === "auditoria" ? (
        <SectionPanel title="Registro de actividad" description="Quien interactuo, a que hora y sobre que entidad.">
          {auditLog.length === 0 ? (
            <div className="workspace-empty">Todavia no hay acciones registradas.</div>
          ) : (
            <div className="workspace-table-wrap">
              <table className="workspace-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Usuario</th>
                    <th>Accion</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDateTime(entry.createdAt)}</td>
                      <td>{entry.actorName}</td>
                      <td>{getAuditActionLabel(entry.action)}</td>
                      <td>{entry.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionPanel>
      ) : null}

      {view === "workflow" ? (
        <div className="workspace-grid-2">
          <SectionPanel title="Estados del flujo" description="Estados visibles por zona y subestados internos disponibles.">
            <div className="space-y-3">
              {workflowStates.map((state) => (
                <article key={`${state.status}-${state.zones.join("-")}`} className="workspace-list-card">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-base font-semibold text-white">{state.status}</div>
                    <span className="workspace-chip">{getWorkflowCategoryLabel(state.category)}</span>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-white/64">{state.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {state.zones.map((zone) => (
                      <span key={`${state.status}-${zone}`} className="workspace-chip workspace-chip-active">
                        {zone}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {state.substatuses.map((substatus) => (
                      <span key={substatus} className="workspace-chip">
                        {substatus}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </SectionPanel>

          <SectionPanel title="Reglas de transicion" description="Condiciones minimas para mover casos entre etapas.">
            <div className="space-y-3">
              {transitionRules.map((rule) => (
                <article key={`${rule.from}-${rule.to}-${rule.zones.join("-")}`} className="workspace-list-card">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="workspace-chip">{rule.from}</span>
                    <span className="text-sm text-white/58">a</span>
                    <span className="workspace-chip workspace-chip-active">{rule.to}</span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-white/66">{rule.note}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {rule.zones.map((zone) => (
                      <span key={`${rule.from}-${rule.to}-${zone}`} className="workspace-chip">
                        {zone}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 text-xs uppercase tracking-[0.16em] text-white/40">Campos requeridos</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {rule.requiredFields.map((field) => (
                      <span key={field} className="workspace-chip">
                        {field}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </SectionPanel>
        </div>
      ) : null}
    </div>
  );
}
