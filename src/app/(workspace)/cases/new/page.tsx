"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useKingestion } from "@/components/workspace/kingestion-provider";
import { ModuleSubnav } from "@/components/workspace/module-subnav";
import { SectionPanel } from "@/components/workspace/section-panel";
import { getAllowedStatusesForZone } from "@/lib/kingston/helpers";
import type { CasePriority, DeliveryMode, KingstonCase, Zone } from "@/lib/kingston/types";

type DraftAttachment = {
  id: string;
  name: string;
  kind: "mail" | "photo" | "proof" | "guide" | "form";
  sizeLabel: string;
  mimeType?: string;
  previewUrl?: string;
};

type DraftCase = {
  kingstonNumber: string;
  clientName: string;
  contactName: string;
  email: string;
  phone: string;
  owner: string;
  status: KingstonCase["externalStatus"];
  zone: Zone;
  delivery: DeliveryMode;
  priority: CasePriority;
  origin: KingstonCase["origin"];
  address: string;
  province: string;
  city: string;
  sku: string;
  quantity: string;
  productDescription: string;
  failureDescription: string;
  nextAction: string;
  notes: string;
  bankName: string;
  accountHolder: string;
  cuit: string;
  cbu: string;
  alias: string;
  accountNumber: string;
  attachments: DraftAttachment[];
};

function getInitialDraft(ownerName?: string): DraftCase {
  return {
    kingstonNumber: "KS-",
    clientName: "",
    contactName: "",
    email: "",
    phone: "+54",
    owner: ownerName ?? "Sin asignar",
    status: "Informado",
    zone: "Interior / Gran Buenos Aires",
    delivery: "Dispatch",
    priority: "Medium",
    origin: "Kingston email",
    address: "",
    province: "",
    city: "",
    sku: "",
    quantity: "1",
    productDescription: "",
    failureDescription: "",
    nextAction: "Validar zona, confirmar alta y enviar primera comunicacion.",
    notes: "",
    bankName: "",
    accountHolder: "",
    cuit: "",
    cbu: "",
    alias: "",
    accountNumber: "",
    attachments: []
  };
}

function createDraftAttachmentId(file: File) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `draft-attachment-${crypto.randomUUID()}`;
  }

  return `draft-attachment-${file.name}-${Date.now()}`;
}

function formatUploadSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function inferAttachmentKind(file: File): DraftAttachment["kind"] {
  const normalizedName = file.name.toLowerCase();

  if (file.type.startsWith("image/")) {
    return "proof";
  }

  if (normalizedName.endsWith(".eml") || normalizedName.endsWith(".msg")) {
    return "mail";
  }

  if (normalizedName.includes("guia") || normalizedName.includes("tracking")) {
    return "guide";
  }

  if (normalizedName.includes("form") || normalizedName.includes("formulario")) {
    return "form";
  }

  return "proof";
}

async function getPreviewUrl(file: File) {
  if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
    return undefined;
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No pude leer el archivo."));
    reader.readAsDataURL(file);
  });
}

export default function NewCasePage() {
  const router = useRouter();
  const { activeOwners, activeOwner, createCase, canManageModule } = useKingestion();
  const [draft, setDraft] = useState<DraftCase>(() => getInitialDraft(activeOwner?.name));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const canManageCases = canManageModule("open-cases");
  const availableStatuses = getAllowedStatusesForZone(draft.zone);

  if (!canManageCases) {
    return (
      <div className="workspace-page">
        <SectionPanel title="Sin permisos" description="Tu usuario no tiene permiso para crear casos.">
          <div className="workspace-empty">Pedi al administrador que revise tus permisos.</div>
        </SectionPanel>
      </div>
    );
  }

  const handleAttachmentChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    const oversizedFile = files.find((file) => file.size > 2 * 1024 * 1024);
    if (oversizedFile) {
      setError(`El archivo ${oversizedFile.name} supera el limite de 2 MB.`);
      return;
    }

    try {
      const nextAttachments = await Promise.all(
        files.map(async (file) => ({
          id: createDraftAttachmentId(file),
          name: file.name,
          kind: inferAttachmentKind(file),
          sizeLabel: formatUploadSize(file.size),
          mimeType: file.type,
          previewUrl: await getPreviewUrl(file)
        }))
      );

      setError(null);
      setDraft((current) => ({
        ...current,
        attachments: [...current.attachments, ...nextAttachments]
      }));
    } catch {
      setError("No pude procesar uno de los adjuntos. Proba con otro archivo.");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const quantity = Number.parseInt(draft.quantity, 10);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("La cantidad tiene que ser un numero mayor a cero.");
      return;
    }

    const requiredValues = [
      draft.kingstonNumber,
      draft.clientName,
      draft.contactName,
      draft.email,
      draft.phone,
      draft.address,
      draft.province,
      draft.city,
      draft.sku,
      draft.productDescription,
      draft.failureDescription
    ];

    if (requiredValues.some((value) => value.trim().length === 0)) {
      setError("Completa los datos principales del caso antes de guardarlo.");
      return;
    }

    setIsSaving(true);

    try {
      const caseId = await createCase({
        kingstonNumber: draft.kingstonNumber,
        clientName: draft.clientName,
        contactName: draft.contactName,
        contactEmail: draft.email,
        contactPhone: draft.phone,
        owner: draft.owner,
        externalStatus: draft.status,
        zone: draft.zone,
        deliveryMode: draft.delivery,
        priority: draft.priority,
        address: draft.address,
        province: draft.province,
        city: draft.city,
        sku: draft.sku,
        quantity,
        productDescription: draft.productDescription,
        failureDescription: draft.failureDescription,
        nextAction: draft.nextAction,
        observations: draft.notes,
        origin: draft.origin,
        banking: {
          bankName: draft.bankName,
          accountHolder: draft.accountHolder,
          cuit: draft.cuit,
          cbu: draft.cbu,
          alias: draft.alias,
          accountNumber: draft.accountNumber
        },
        attachments: draft.attachments.map((attachment) => ({
          name: attachment.name,
          kind: attachment.kind,
          sizeLabel: attachment.sizeLabel,
          mimeType: attachment.mimeType,
          previewUrl: attachment.previewUrl
        }))
      });

      router.push(`/cases/${caseId}`);
      router.refresh();
    } catch {
      setIsSaving(false);
      setError("No pude guardar el caso. Proba de nuevo y, si sigue fallando, lo reviso.");
    }
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
            <button className="workspace-button" type="submit" form="new-case-form" disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar caso"}
            </button>
            <Link className="workspace-button-secondary" href="/cases">
              Volver a la bandeja
            </Link>
          </div>
        </div>
        <p className="workspace-subtitle">
          Alta operativa completa con guardado real dentro del workspace actual. Al guardar se abre el detalle del caso.
        </p>
      </header>

      <ModuleSubnav
        items={[
          { href: "/cases", label: "Casos abiertos" },
          { href: "/cases/new", label: "Nuevo caso", active: true }
        ]}
      />

      <div className="workspace-grid-2">
        <SectionPanel title="Alta operativa" description="Datos del caso, cliente, operacion y bancarios necesarios para empezar a trabajarlo.">
          <form id="new-case-form" className="workspace-inline-form" onSubmit={handleSubmit}>
            <div className="space-y-5">
              <div>
                <p className="workspace-kicker">Caso y contacto</p>
                <div className="workspace-form-grid mt-4">
                  <label className="workspace-label">
                    <span>Numero Kingston</span>
                    <input
                      className="workspace-input"
                      value={draft.kingstonNumber}
                      onChange={(event) => setDraft((current) => ({ ...current, kingstonNumber: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="workspace-label">
                    <span>Cliente</span>
                    <input
                      className="workspace-input"
                      value={draft.clientName}
                      onChange={(event) => setDraft((current) => ({ ...current, clientName: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="workspace-label">
                    <span>Contacto</span>
                    <input
                      className="workspace-input"
                      value={draft.contactName}
                      onChange={(event) => setDraft((current) => ({ ...current, contactName: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="workspace-label">
                    <span>Email</span>
                    <input
                      className="workspace-input"
                      type="email"
                      value={draft.email}
                      onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="workspace-label">
                    <span>Telefono</span>
                    <input
                      className="workspace-input"
                      type="tel"
                      value={draft.phone}
                      onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="workspace-label">
                    <span>Responsable</span>
                    <select
                      className="workspace-select"
                      value={draft.owner}
                      onChange={(event) => setDraft((current) => ({ ...current, owner: event.target.value }))}
                    >
                      {activeOwners.map((owner) => (
                        <option key={owner.id} value={owner.name}>
                          {owner.name}
                        </option>
                      ))}
                      <option value="Sin asignar">Sin asignar</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="border-t border-white/8 pt-5">
                <p className="workspace-kicker">Operacion</p>
                <div className="workspace-form-grid mt-4">
                  <label className="workspace-label">
                    <span>Estado inicial</span>
                    <select
                      className="workspace-select"
                      value={draft.status}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          status: event.target.value as KingstonCase["externalStatus"]
                        }))
                      }
                    >
                      {availableStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="workspace-label">
                    <span>Prioridad</span>
                    <select
                      className="workspace-select"
                      value={draft.priority}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, priority: event.target.value as CasePriority }))
                      }
                    >
                      <option value="Low">Baja</option>
                      <option value="Medium">Media</option>
                      <option value="High">Alta</option>
                      <option value="Critical">Critica</option>
                    </select>
                  </label>
                  <label className="workspace-label">
                    <span>Zona</span>
                    <select
                      className="workspace-select"
                      value={draft.zone}
                      onChange={(event) =>
                        setDraft((current) => {
                          const nextZone = event.target.value as Zone;
                          const nextStatuses = getAllowedStatusesForZone(nextZone);
                          const nextStatus = nextStatuses.includes(current.status) ? current.status : nextStatuses[0];

                          return {
                            ...current,
                            zone: nextZone,
                            status: nextStatus
                          };
                        })
                      }
                    >
                      <option value="Interior / Gran Buenos Aires">Interior / Gran Buenos Aires</option>
                      <option value="Capital / AMBA">Capital / AMBA</option>
                    </select>
                  </label>
                  <label className="workspace-label">
                    <span>Modalidad</span>
                    <select
                      className="workspace-select"
                      value={draft.delivery}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, delivery: event.target.value as DeliveryMode }))
                      }
                    >
                      <option value="Dispatch">Envio</option>
                      <option value="Pickup">Retiro</option>
                    </select>
                  </label>
                  <label className="workspace-label">
                    <span>Origen</span>
                    <select
                      className="workspace-select"
                      value={draft.origin}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          origin: event.target.value as KingstonCase["origin"]
                        }))
                      }
                    >
                      <option value="Kingston email">Correo de Kingston</option>
                      <option value="Operations load">Carga de operaciones</option>
                      <option value="Commercial handoff">Pase comercial</option>
                    </select>
                  </label>
                  <label className="workspace-label">
                    <span>SKU</span>
                    <input
                      className="workspace-input"
                      value={draft.sku}
                      onChange={(event) => setDraft((current) => ({ ...current, sku: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="workspace-label">
                    <span>Cantidad</span>
                    <input
                      className="workspace-input"
                      type="number"
                      min={1}
                      value={draft.quantity}
                      onChange={(event) => setDraft((current) => ({ ...current, quantity: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="workspace-label">
                    <span>Descripcion del producto</span>
                    <input
                      className="workspace-input"
                      value={draft.productDescription}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, productDescription: event.target.value }))
                      }
                      required
                    />
                  </label>
                  <label className="workspace-label">
                    <span>Direccion exacta</span>
                    <input
                      className="workspace-input"
                      value={draft.address}
                      onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="workspace-label">
                    <span>Provincia</span>
                    <input
                      className="workspace-input"
                      value={draft.province}
                      onChange={(event) => setDraft((current) => ({ ...current, province: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="workspace-label">
                    <span>Localidad</span>
                    <input
                      className="workspace-input"
                      value={draft.city}
                      onChange={(event) => setDraft((current) => ({ ...current, city: event.target.value }))}
                      required
                    />
                  </label>
                </div>
              </div>

              <div className="border-t border-white/8 pt-5">
                <p className="workspace-kicker">Detalle y soporte</p>

                <label className="workspace-label mt-4">
                  <span>Proxima accion</span>
                  <input
                    className="workspace-input"
                    value={draft.nextAction}
                    onChange={(event) => setDraft((current) => ({ ...current, nextAction: event.target.value }))}
                  />
                </label>

                <label className="workspace-label mt-4">
                  <span>Descripcion de la falla</span>
                  <textarea
                    className="workspace-textarea"
                    value={draft.failureDescription}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, failureDescription: event.target.value }))
                    }
                    required
                  />
                </label>

                <label className="workspace-label mt-4">
                  <span>Observaciones internas</span>
                  <textarea
                    className="workspace-textarea"
                    value={draft.notes}
                    onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                  />
                </label>

                <div className="workspace-form-grid mt-4">
                  <label className="workspace-label">
                    <span>Banco</span>
                    <input
                      className="workspace-input"
                      value={draft.bankName}
                      onChange={(event) => setDraft((current) => ({ ...current, bankName: event.target.value }))}
                    />
                  </label>
                  <label className="workspace-label">
                    <span>Titular</span>
                    <input
                      className="workspace-input"
                      value={draft.accountHolder}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, accountHolder: event.target.value }))
                      }
                    />
                  </label>
                  <label className="workspace-label">
                    <span>CUIT</span>
                    <input
                      className="workspace-input"
                      value={draft.cuit}
                      onChange={(event) => setDraft((current) => ({ ...current, cuit: event.target.value }))}
                    />
                  </label>
                  <label className="workspace-label">
                    <span>CBU</span>
                    <input
                      className="workspace-input"
                      value={draft.cbu}
                      onChange={(event) => setDraft((current) => ({ ...current, cbu: event.target.value }))}
                    />
                  </label>
                  <label className="workspace-label">
                    <span>Alias</span>
                    <input
                      className="workspace-input"
                      value={draft.alias}
                      onChange={(event) => setDraft((current) => ({ ...current, alias: event.target.value }))}
                    />
                  </label>
                  <label className="workspace-label">
                    <span>Nro. de cuenta</span>
                    <input
                      className="workspace-input"
                      value={draft.accountNumber}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, accountNumber: event.target.value }))
                      }
                    />
                  </label>
                </div>

                <div className="workspace-inline-form mt-4">
                  <label className="workspace-label">
                    <span>Adjuntos iniciales</span>
                    <input
                      className="workspace-file-input"
                      type="file"
                      multiple
                      onChange={handleAttachmentChange}
                    />
                  </label>

                  {draft.attachments.length > 0 ? (
                    <div className="space-y-3">
                      {draft.attachments.map((attachment) => (
                        <article key={attachment.id} className="workspace-list-card">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-white">{attachment.name}</div>
                              <div className="mt-1 text-sm text-white/58">
                                {attachment.kind} / {attachment.sizeLabel}
                              </div>
                            </div>
                            <button
                              className="workspace-link-button workspace-link-button-danger"
                              type="button"
                              onClick={() =>
                                setDraft((current) => ({
                                  ...current,
                                  attachments: current.attachments.filter((item) => item.id !== attachment.id)
                                }))
                              }
                            >
                              Eliminar
                            </button>
                          </div>
                          {attachment.previewUrl ? (
                            attachment.mimeType === "application/pdf" ? (
                              <div className="mt-3">
                                <a
                                  className="workspace-link-button"
                                  href={attachment.previewUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Abrir PDF
                                </a>
                              </div>
                            ) : (
                              <div className="workspace-proof-preview mt-3">
                                <img
                                  src={attachment.previewUrl}
                                  alt={`Adjunto ${attachment.name}`}
                                  className="workspace-proof-image"
                                />
                              </div>
                            )
                          ) : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="workspace-empty">Todavia no hay adjuntos iniciales cargados.</div>
                  )}
                </div>
              </div>
            </div>

            {error ? <div className="workspace-empty">{error}</div> : null}

            <div className="workspace-chip-row">
              <button className="workspace-button" type="submit" disabled={isSaving}>
                {isSaving ? "Guardando..." : "Guardar caso"}
              </button>
              <button
                className="workspace-button-secondary"
                type="button"
                onClick={() => {
                  setError(null);
                  setDraft(getInitialDraft(activeOwner?.name));
                }}
              >
                Reiniciar formulario
              </button>
            </div>
          </form>
        </SectionPanel>

        <SectionPanel title="Vista previa" description="Chequeo rapido antes de crear el caso y abrir su detalle.">
          <dl className="workspace-data-list">
            <div className="workspace-data-item">
              <dt>Ticket Kingston</dt>
              <dd>{draft.kingstonNumber || "Pendiente"}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>Cliente y contacto</dt>
              <dd>
                {draft.clientName || "Cliente pendiente"} / {draft.contactName || "Contacto pendiente"}
              </dd>
            </div>
            <div className="workspace-data-item">
              <dt>Ruta operativa</dt>
              <dd>
                {draft.zone} / {draft.delivery === "Dispatch" ? "Envio" : "Retiro"} / {draft.status}
              </dd>
            </div>
            <div className="workspace-data-item">
              <dt>Direccion</dt>
              <dd>
                {draft.address || "Direccion pendiente"}
                {draft.city || draft.province ? `, ${draft.city}, ${draft.province}` : ""}
              </dd>
            </div>
            <div className="workspace-data-item">
              <dt>Producto</dt>
              <dd>
                {draft.sku || "SKU pendiente"} / {draft.productDescription || "Descripcion pendiente"} /{" "}
                {draft.quantity || "0"} un.
              </dd>
            </div>
            <div className="workspace-data-item">
              <dt>Responsable</dt>
              <dd>{draft.owner}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>Proxima accion</dt>
              <dd>{draft.nextAction}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>Falla</dt>
              <dd>{draft.failureDescription || "Sin descripcion cargada."}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>Datos bancarios</dt>
              <dd>
                {draft.bankName || draft.accountHolder || draft.alias
                  ? `${draft.bankName || "Banco pendiente"} / ${draft.accountHolder || "Titular pendiente"} / ${draft.alias || "Alias pendiente"}`
                  : "Se completaran luego o se tomaran del cliente conocido."}
              </dd>
            </div>
            <div className="workspace-data-item">
              <dt>Adjuntos</dt>
              <dd>
                {draft.attachments.length > 0
                  ? draft.attachments.map((attachment) => attachment.name).join(", ")
                  : "Sin adjuntos iniciales"}
              </dd>
            </div>
          </dl>
        </SectionPanel>
      </div>
    </div>
  );
}
