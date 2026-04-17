"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { ModuleSubnav } from "@/components/workspace/module-subnav";
import { SectionPanel } from "@/components/workspace/section-panel";
import { useKingestion } from "@/components/workspace/kingestion-provider";
import { transitionRules, workflowStates } from "@/lib/kingston/data";
import {
  formatDateTime,
  getAuditActionLabel,
  getTeamLabel,
  getWorkflowCategoryLabel
} from "@/lib/kingston/helpers";
import type { OwnerDirectoryEntry } from "@/lib/kingston/types";

type SettingsView = "responsables" | "asignaciones" | "auditoria" | "workflow";

type OwnerFormState = {
  name: string;
  email: string;
  team: OwnerDirectoryEntry["team"];
  active: boolean;
};

const emptyOwnerForm: OwnerFormState = {
  name: "",
  email: "",
  team: "Operations",
  active: true
};

function getView(value: string | null): SettingsView {
  switch (value) {
    case "asignaciones":
    case "auditoria":
    case "workflow":
      return value;
    default:
      return "responsables";
  }
}

export function SettingsModule() {
  const searchParams = useSearchParams();
  const view = getView(searchParams.get("view"));
  const {
    activeOwner,
    activeOwners,
    owners,
    openCases,
    auditLog,
    setActiveOwner,
    createOwner,
    updateOwner,
    deleteOwner,
    assignCaseOwner
  } = useKingestion();
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

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formState.name.trim() || !formState.email.trim()) {
      return;
    }

    if (editingOwnerId) {
      updateOwner(editingOwnerId, formState);
    } else {
      createOwner(formState);
    }

    resetForm();
  };

  const startEditing = (owner: OwnerDirectoryEntry) => {
    setEditingOwnerId(owner.id);
    setFormState({
      name: owner.name,
      email: owner.email,
      team: owner.team,
      active: owner.active
    });
  };

  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="workspace-page-header-row">
          <div>
            <p className="workspace-kicker">Configuracion</p>
            <h1 className="workspace-title">Usuarios, responsables y control</h1>
          </div>

          <div className="workspace-chip-row">
            <Link className="workspace-button-secondary" href="/cases">
              Ir a casos
            </Link>
          </div>
        </div>
        <p className="workspace-subtitle">
          Configuracion separada por submodulos para no mezclar directorio, asignaciones y auditoria en un unico panel.
        </p>
      </header>

      <ModuleSubnav
        items={[
          { href: "/settings?view=responsables", label: "Responsables", active: view === "responsables" },
          { href: "/settings?view=asignaciones", label: "Asignaciones", active: view === "asignaciones" },
          { href: "/settings?view=auditoria", label: "Auditoria", active: view === "auditoria" },
          { href: "/settings?view=workflow", label: "Workflow", active: view === "workflow" }
        ]}
      />

      {view === "responsables" ? (
        <div className="workspace-grid-2">
          <SectionPanel title="Usuario activo" description="Selecciona quien esta operando para registrar autoria en cada accion.">
            <div className="workspace-inline-form">
              <label className="workspace-label">
                <span>Sesion actual</span>
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
              <div className="workspace-empty">
                Los cambios de estado, asignacion y descarga de reportes quedan registrados con este usuario.
              </div>
            </div>
          </SectionPanel>

          <SectionPanel title={editingOwnerId ? "Editar responsable" : "Nuevo responsable"} description="Alta y mantenimiento del directorio operativo.">
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
                <span>Equipo</span>
                <select
                  className="workspace-select"
                  value={formState.team}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      team: event.target.value as OwnerDirectoryEntry["team"]
                    }))
                  }
                >
                  <option value="Operations">Operaciones</option>
                  <option value="Logistics">Logistica</option>
                  <option value="Purchasing">Compras</option>
                  <option value="Warehouse">Deposito</option>
                  <option value="Management">Gerencia</option>
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

              <div className="workspace-chip-row">
                <button className="workspace-button" type="submit">
                  {editingOwnerId ? "Guardar cambios" : "Crear responsable"}
                </button>
                {editingOwnerId ? (
                  <button className="workspace-button-secondary" type="button" onClick={resetForm}>
                    Cancelar
                  </button>
                ) : null}
              </div>
            </form>
          </SectionPanel>

          <SectionPanel title="Directorio operativo" description="Responsables editables y eliminables, con su disponibilidad actual.">
            <div className="workspace-table-wrap">
              <table className="workspace-table">
                <thead>
                  <tr>
                    <th>Responsable</th>
                    <th>Equipo</th>
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
                      <td>{getTeamLabel(owner.team)}</td>
                      <td>{owner.active ? "Activo" : "Inactivo"}</td>
                      <td>
                        <div className="workspace-inline-actions">
                          <button className="workspace-link-button" type="button" onClick={() => startEditing(owner)}>
                            Editar
                          </button>
                          <button
                            className="workspace-link-button workspace-link-button-danger"
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Se va a eliminar a ${owner.name}. Continuar?`)) {
                                deleteOwner(owner.id);
                                if (editingOwnerId === owner.id) {
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
          <SectionPanel title="Estados del flujo" description="Estados visibles y subestados internos disponibles.">
            <div className="space-y-3">
              {workflowStates.map((state) => (
                <article key={state.status} className="workspace-list-card">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-base font-semibold text-white">{state.status}</div>
                    <span className="workspace-chip">{getWorkflowCategoryLabel(state.category)}</span>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-white/64">{state.description}</p>
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
                <article key={`${rule.from}-${rule.to}`} className="workspace-list-card">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="workspace-chip">{rule.from}</span>
                    <span className="text-sm text-white/58">a</span>
                    <span className="workspace-chip workspace-chip-active">{rule.to}</span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-white/66">{rule.note}</p>
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
