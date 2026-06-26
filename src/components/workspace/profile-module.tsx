"use client";

import { useEffect, useState } from "react";

import { SectionPanel } from "@/components/workspace/section-panel";
import { useKingestion } from "@/components/workspace/kingestion-provider";
import { getRoleLabel } from "@/lib/kingston/helpers";

export function ProfileModule() {
  const { activeOwner, refreshWorkspace } = useKingestion();
  const [name, setName] = useState(activeOwner.name);
  const [email, setEmail] = useState(activeOwner.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(activeOwner.name);
    setEmail(activeOwner.email);
  }, [activeOwner.email, activeOwner.name]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          email,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "No pude actualizar el perfil.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setMessage("Perfil actualizado correctamente.");
      await refreshWorkspace();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No pude actualizar el perfil.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="workspace-page">
      <div className="workspace-grid-2">
        <SectionPanel title="Mi perfil" description="Datos personales de la cuenta activa.">
          <form className="workspace-inline-form" onSubmit={handleSubmit}>
            <label className="workspace-label">
              <span>Nombre</span>
              <input className="workspace-input" value={name} onChange={(event) => setName(event.target.value)} />
            </label>

            <label className="workspace-label">
              <span>Email</span>
              <input className="workspace-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>

            <label className="workspace-label">
              <span>Contrasena actual</span>
              <input
                className="workspace-input"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Solo si vas a cambiar la contrasena"
              />
            </label>

            <label className="workspace-label">
              <span>Nueva contrasena</span>
              <input
                className="workspace-input"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Minimo 8 caracteres"
              />
            </label>

            {message ? <div className="workspace-empty">{message}</div> : null}
            {error ? <div className="workspace-empty">{error}</div> : null}

            <div className="workspace-inline-actions">
              <button className="workspace-button" type="submit" disabled={isSaving}>
                {isSaving ? "Guardando..." : "Guardar perfil"}
              </button>
            </div>
          </form>
        </SectionPanel>

        <SectionPanel title="Cuenta actual" description="Resumen de permisos y sector asociado.">
          <div className="workspace-data-list">
            <div className="workspace-data-item">
              <dt>Usuario</dt>
              <dd>{activeOwner.name}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>Email</dt>
              <dd>{activeOwner.email}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>Sector</dt>
              <dd>{getRoleLabel(activeOwner.team)}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>Estado</dt>
              <dd>{activeOwner.active ? "Activo" : "Inactivo"}</dd>
            </div>
          </div>
        </SectionPanel>
      </div>
    </div>
  );
}
