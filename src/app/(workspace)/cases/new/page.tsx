"use client";

import { useState } from "react";
import Link from "next/link";

import { ModuleSubnav } from "@/components/workspace/module-subnav";
import { SectionPanel } from "@/components/workspace/section-panel";
import { useKingestion } from "@/components/workspace/kingestion-provider";
import { workflowStates } from "@/lib/kingston/data";

type DraftCase = {
  kingstonNumber: string;
  clientName: string;
  contactName: string;
  email: string;
  phone: string;
  owner: string;
  status: string;
  zone: string;
  delivery: string;
  sku: string;
  quantity: string;
  productDescription: string;
  failureDescription: string;
  nextAction: string;
  notes: string;
};

const initialDraft: DraftCase = {
  kingstonNumber: "KS-",
  clientName: "Cliente sin definir",
  contactName: "Contacto sin definir",
  email: "contacto@cliente.com",
  phone: "+54",
  owner: "",
  status: "Informado",
  zone: "Interior / Gran Buenos Aires",
  delivery: "Dispatch",
  sku: "SKU pendiente",
  quantity: "1",
  productDescription: "Descripcion pendiente",
  failureDescription: "Sin descripcion de falla",
  nextAction: "Validar zona, confirmar alta y enviar primera comunicacion.",
  notes: "Sin observaciones cargadas."
};

export default function NewCasePage() {
  const { activeOwners, activeOwner } = useKingestion();
  const [draft, setDraft] = useState<DraftCase>(() => ({
    ...initialDraft,
    owner: activeOwner?.name ?? activeOwners[0]?.name ?? "Sin asignar"
  }));

  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="workspace-page-header-row">
          <div>
            <p className="workspace-kicker">Casos</p>
            <h1 className="workspace-title">Nuevo caso</h1>
          </div>

          <div className="workspace-chip-row">
            <Link className="workspace-button-secondary" href="/cases">
              Volver a la bandeja
            </Link>
          </div>
        </div>
        <p className="workspace-subtitle">
          Formulario preliminar para definir el alta. Queda como vista previa mientras terminamos el guardado real.
        </p>
      </header>

      <ModuleSubnav
        items={[
          { href: "/cases", label: "Casos abiertos" },
          { href: "/cases/new", label: "Nuevo caso", active: true }
        ]}
      />

      <div className="workspace-grid-2">
        <SectionPanel title="Carga inicial" description="Campos base para empezar la operacion.">
          <form className="workspace-inline-form">
            <div className="workspace-form-grid">
              <label className="workspace-label">
                <span>Numero Kingston</span>
                <input className="workspace-input" value={draft.kingstonNumber} onChange={(event) => setDraft((current) => ({ ...current, kingstonNumber: event.target.value }))} />
              </label>
              <label className="workspace-label">
                <span>Cliente</span>
                <input className="workspace-input" value={draft.clientName} onChange={(event) => setDraft((current) => ({ ...current, clientName: event.target.value }))} />
              </label>
              <label className="workspace-label">
                <span>Contacto</span>
                <input className="workspace-input" value={draft.contactName} onChange={(event) => setDraft((current) => ({ ...current, contactName: event.target.value }))} />
              </label>
              <label className="workspace-label">
                <span>Email</span>
                <input className="workspace-input" value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} />
              </label>
              <label className="workspace-label">
                <span>Telefono</span>
                <input className="workspace-input" value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} />
              </label>
              <label className="workspace-label">
                <span>Responsable</span>
                <select className="workspace-select" value={draft.owner} onChange={(event) => setDraft((current) => ({ ...current, owner: event.target.value }))}>
                  {activeOwners.map((owner) => (
                    <option key={owner.id} value={owner.name}>
                      {owner.name}
                    </option>
                  ))}
                  <option value="Sin asignar">Sin asignar</option>
                </select>
              </label>
              <label className="workspace-label">
                <span>Estado inicial</span>
                <select className="workspace-select" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}>
                  {workflowStates.map((state) => (
                    <option key={state.status} value={state.status}>
                      {state.status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="workspace-label">
                <span>Zona</span>
                <select className="workspace-select" value={draft.zone} onChange={(event) => setDraft((current) => ({ ...current, zone: event.target.value }))}>
                  <option value="Interior / Gran Buenos Aires">Interior / Gran Buenos Aires</option>
                  <option value="Capital / AMBA">Capital / AMBA</option>
                </select>
              </label>
              <label className="workspace-label">
                <span>Modalidad</span>
                <select className="workspace-select" value={draft.delivery} onChange={(event) => setDraft((current) => ({ ...current, delivery: event.target.value }))}>
                  <option value="Dispatch">Envio</option>
                  <option value="Pickup">Retiro</option>
                </select>
              </label>
              <label className="workspace-label">
                <span>SKU</span>
                <input className="workspace-input" value={draft.sku} onChange={(event) => setDraft((current) => ({ ...current, sku: event.target.value }))} />
              </label>
              <label className="workspace-label">
                <span>Cantidad</span>
                <input className="workspace-input" value={draft.quantity} onChange={(event) => setDraft((current) => ({ ...current, quantity: event.target.value }))} />
              </label>
              <label className="workspace-label">
                <span>Descripcion del producto</span>
                <input className="workspace-input" value={draft.productDescription} onChange={(event) => setDraft((current) => ({ ...current, productDescription: event.target.value }))} />
              </label>
            </div>

            <label className="workspace-label">
              <span>Proxima accion</span>
              <input className="workspace-input" value={draft.nextAction} onChange={(event) => setDraft((current) => ({ ...current, nextAction: event.target.value }))} />
            </label>

            <label className="workspace-label">
              <span>Descripcion de la falla</span>
              <textarea className="workspace-textarea" value={draft.failureDescription} onChange={(event) => setDraft((current) => ({ ...current, failureDescription: event.target.value }))} />
            </label>

            <label className="workspace-label">
              <span>Observaciones</span>
              <textarea className="workspace-textarea" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
            </label>
          </form>
        </SectionPanel>

        <SectionPanel title="Vista previa" description="Resumen rapido del caso antes de conectarlo al guardado definitivo.">
          <dl className="workspace-data-list">
            <div className="workspace-data-item">
              <dt>Ticket Kingston</dt>
              <dd>{draft.kingstonNumber}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>Cliente y contacto</dt>
              <dd>
                {draft.clientName} / {draft.contactName}
              </dd>
            </div>
            <div className="workspace-data-item">
              <dt>Responsable</dt>
              <dd>{draft.owner}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>Estado inicial</dt>
              <dd>{draft.status}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>Ruta operativa</dt>
              <dd>
                {draft.zone} / {draft.delivery === "Dispatch" ? "Envio" : "Retiro"}
              </dd>
            </div>
            <div className="workspace-data-item">
              <dt>Producto</dt>
              <dd>
                {draft.sku} / {draft.productDescription} / {draft.quantity} un.
              </dd>
            </div>
            <div className="workspace-data-item">
              <dt>Proxima accion</dt>
              <dd>{draft.nextAction}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>Falla</dt>
              <dd>{draft.failureDescription}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>Observaciones</dt>
              <dd>{draft.notes}</dd>
            </div>
          </dl>
        </SectionPanel>
      </div>
    </div>
  );
}
