import Link from "next/link";

import { ModuleSubnav } from "@/components/workspace/module-subnav";
import { SectionPanel } from "@/components/workspace/section-panel";
import { ownerDirectory, workflowStates } from "@/lib/kingston/data";

type NewCasePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function valueOf(entry: string | string[] | undefined, fallback = "") {
  if (Array.isArray(entry)) {
    return entry[0] ?? fallback;
  }

  return entry ?? fallback;
}

export default async function NewCasePage({ searchParams }: NewCasePageProps) {
  const resolved = await searchParams;
  const draft = {
    kingstonNumber: valueOf(resolved.kingstonNumber, "KS-"),
    clientName: valueOf(resolved.clientName, "Cliente sin definir"),
    contactName: valueOf(resolved.contactName, "Contacto sin definir"),
    email: valueOf(resolved.email, "contacto@cliente.com"),
    phone: valueOf(resolved.phone, "+54"),
    owner: valueOf(resolved.owner, "Lucia Costa"),
    status: valueOf(resolved.status, "Informado"),
    zone: valueOf(resolved.zone, "Interior / Gran Buenos Aires"),
    delivery: valueOf(resolved.delivery, "Dispatch"),
    sku: valueOf(resolved.sku, "SKU pendiente"),
    quantity: valueOf(resolved.quantity, "1"),
    productDescription: valueOf(resolved.productDescription, "Descripcion pendiente"),
    failureDescription: valueOf(resolved.failureDescription, "Sin descripcion de falla"),
    nextAction: valueOf(resolved.nextAction, "Validar zona, confirmar alta y enviar primera comunicacion."),
    notes: valueOf(resolved.notes, "Sin observaciones cargadas.")
  };

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
          Formulario inicial para definir la estructura del alta. Por ahora esta conectado como vista previa interactiva, para validar el flujo antes de enlazarlo a la base.
        </p>
      </header>

      <ModuleSubnav
        items={[
          { href: "/cases", label: "Bandeja" },
          { href: "/cases/new", label: "Nuevo caso", active: true }
        ]}
      />

      <div className="workspace-grid-2">
        <SectionPanel title="Carga inicial" description="Completa los datos y usa la vista previa para verificar el caso antes de conectar el guardado real.">
          <form action="/cases/new" className="workspace-inline-form">
            <div className="workspace-form-grid">
              <label className="workspace-label">
                <span>Numero Kingston</span>
                <input className="workspace-input" name="kingstonNumber" defaultValue={draft.kingstonNumber} />
              </label>
              <label className="workspace-label">
                <span>Cliente</span>
                <input className="workspace-input" name="clientName" defaultValue={draft.clientName} />
              </label>
              <label className="workspace-label">
                <span>Contacto</span>
                <input className="workspace-input" name="contactName" defaultValue={draft.contactName} />
              </label>
              <label className="workspace-label">
                <span>Email</span>
                <input className="workspace-input" name="email" defaultValue={draft.email} />
              </label>
              <label className="workspace-label">
                <span>Telefono</span>
                <input className="workspace-input" name="phone" defaultValue={draft.phone} />
              </label>
              <label className="workspace-label">
                <span>Responsable</span>
                <select className="workspace-select" name="owner" defaultValue={draft.owner}>
                  {ownerDirectory.map((owner) => (
                    <option key={owner.name} value={owner.name}>
                      {owner.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="workspace-label">
                <span>Estado inicial</span>
                <select className="workspace-select" name="status" defaultValue={draft.status}>
                  {workflowStates.map((state) => (
                    <option key={state.status} value={state.status}>
                      {state.status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="workspace-label">
                <span>Zona</span>
                <select className="workspace-select" name="zone" defaultValue={draft.zone}>
                  <option value="Interior / Gran Buenos Aires">Interior / Gran Buenos Aires</option>
                  <option value="Capital / AMBA">Capital / AMBA</option>
                </select>
              </label>
              <label className="workspace-label">
                <span>Modalidad</span>
                <select className="workspace-select" name="delivery" defaultValue={draft.delivery}>
                  <option value="Dispatch">Envio</option>
                  <option value="Pickup">Retiro</option>
                </select>
              </label>
              <label className="workspace-label">
                <span>SKU</span>
                <input className="workspace-input" name="sku" defaultValue={draft.sku} />
              </label>
              <label className="workspace-label">
                <span>Cantidad</span>
                <input className="workspace-input" name="quantity" defaultValue={draft.quantity} />
              </label>
              <label className="workspace-label">
                <span>Descripcion del producto</span>
                <input className="workspace-input" name="productDescription" defaultValue={draft.productDescription} />
              </label>
            </div>

            <label className="workspace-label">
              <span>Proxima accion</span>
              <input className="workspace-input" name="nextAction" defaultValue={draft.nextAction} />
            </label>

            <label className="workspace-label">
              <span>Descripcion de la falla</span>
              <textarea className="workspace-textarea" name="failureDescription" defaultValue={draft.failureDescription} />
            </label>

            <label className="workspace-label">
              <span>Observaciones</span>
              <textarea className="workspace-textarea" name="notes" defaultValue={draft.notes} />
            </label>

            <div className="workspace-chip-row">
              <button className="workspace-button" type="submit">
                Actualizar vista previa
              </button>
              <Link className="workspace-button-secondary" href="/cases">
                Cancelar
              </Link>
            </div>
          </form>
        </SectionPanel>

        <SectionPanel title="Vista previa" description="Resumen del caso con el formato que luego usara la bandeja y el detalle.">
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
