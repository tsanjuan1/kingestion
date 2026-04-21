"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { CaseStatusSelect } from "@/components/workspace/case-status-select";
import { EventTimeline } from "@/components/workspace/event-timeline";
import { ModuleSubnav } from "@/components/workspace/module-subnav";
import { SectionPanel } from "@/components/workspace/section-panel";
import { StatusPill } from "@/components/workspace/status-pill";
import { TaskList } from "@/components/workspace/task-list";
import { useKingestion } from "@/components/workspace/kingestion-provider";
import {
  buildCaseAddress,
  formatDate,
  formatDateTime,
  getAttachmentKindLabel,
  getAvailabilityLabel,
  getCaseAgingDays,
  getDeliveryModeLabel,
  getOriginLabel,
  getOwnerInitials,
  getOwnerRole,
  getPriorityLabel,
  getReimbursementStateLabel,
  getSlaLabel,
  getTeamLabel,
  isClosedCaseStatus
} from "@/lib/kingston/helpers";
import type { CaseAttachment } from "@/lib/kingston/types";

type DetailTab = "resumen" | "cliente" | "producto" | "operacion" | "historial";

function getTab(value: string | null): DetailTab {
  switch (value) {
    case "cliente":
    case "producto":
    case "operacion":
    case "historial":
      return value;
    default:
      return "resumen";
  }
}

function formatUploadSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function inferAttachmentKind(file: File): CaseAttachment["kind"] {
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

export function CaseDetailModule() {
  const params = useParams<{ caseId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = getTab(searchParams.get("tab"));
  const hasLoggedView = useRef(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentSuccess, setAttachmentSuccess] = useState<string | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [replacementSkuDraft, setReplacementSkuDraft] = useState("");
  const [replacementSuccess, setReplacementSuccess] = useState<string | null>(null);
  const {
    findCaseById,
    activeOwners,
    assignCaseOwner,
    updateCaseStatus,
    addCaseAttachment,
    removeCaseAttachment,
    updateReplacementSku,
    deleteCase,
    auditLog,
    canDeleteCases,
    canAccessModule,
    canManageModule,
    recordCaseView
  } = useKingestion();
  const entry = findCaseById(params.caseId);

  useEffect(() => {
    if (!entry || hasLoggedView.current) return;
    hasLoggedView.current = true;
    void recordCaseView(entry.id);
  }, [entry, recordCaseView]);

  useEffect(() => {
    setReplacementSkuDraft(entry?.replacementSku ?? "");
  }, [entry?.replacementSku]);

  if (!entry) {
    return (
      <div className="workspace-page">
        <SectionPanel title="Caso no encontrado" description="El identificador solicitado no existe dentro del workspace actual.">
          <Link className="workspace-button" href="/cases">
            Volver a casos abiertos
          </Link>
        </SectionPanel>
      </div>
    );
  }

  const canSeeCase = isClosedCaseStatus(entry.externalStatus)
    ? canAccessModule("closed-cases")
    : canAccessModule("open-cases");

  if (!canSeeCase) {
    return (
      <div className="workspace-page">
        <SectionPanel title="Sin permisos" description="Tu usuario no tiene acceso a este caso.">
          <div className="workspace-empty">Pedi al administrador que revise tus permisos.</div>
        </SectionPanel>
      </div>
    );
  }

  const canManageCases = canManageModule("open-cases");

  const taskItems = entry.tasks.map((task) => ({
    ...task,
    caseId: entry.id,
    caseNumber: entry.internalNumber,
    clientName: entry.clientName
  }));
  const caseAudit = auditLog.filter((item) => item.entityType === "case" && item.entityId === entry.id).slice(0, 10);
  const banking = entry.banking;
  const latestProofAttachment =
    entry.attachments.find((attachment) => attachment.kind === "proof" || attachment.kind === "photo") ?? null;

  const handleAttachmentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setAttachmentError(null);
    setAttachmentSuccess(null);

    if (file.size > 2 * 1024 * 1024) {
      setAttachmentError("El archivo no puede superar los 2 MB para asegurar la sincronizacion entre equipos.");
      return;
    }

    setIsUploadingAttachment(true);

    try {
      const previewUrl = await getPreviewUrl(file);
      const saved = await addCaseAttachment(entry.id, {
        name: file.name,
        kind: inferAttachmentKind(file),
        sizeLabel: formatUploadSize(file.size),
        mimeType: file.type,
        previewUrl
      });

      if (!saved) {
        setAttachmentError("No pude guardar el adjunto en este caso.");
        return;
      }

      setAttachmentSuccess("Adjunto cargado correctamente.");
    } catch {
      setAttachmentError("No pude procesar el archivo. Proba con otro.");
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleRemoveAttachment = async (attachmentId: string, attachmentName: string) => {
    const confirmed = window.confirm(`Se va a eliminar ${attachmentName}. Continuar?`);
    if (!confirmed) {
      return;
    }

    const removed = await removeCaseAttachment(entry.id, attachmentId);
    if (!removed) {
      setAttachmentError("No pude eliminar el adjunto.");
      return;
    }

    setAttachmentError(null);
    setAttachmentSuccess("Adjunto eliminado correctamente.");
  };

  const handleReplacementSkuSave = async () => {
    const updated = await updateReplacementSku(entry.id, replacementSkuDraft);

    if (!updated) {
      setReplacementSuccess("No pude guardar el SKU de reemplazo.");
      return;
    }

    setReplacementSuccess("SKU de reemplazo actualizado.");
  };

  const handleDeleteCase = async () => {
    const confirmed = window.confirm(`Se va a eliminar ${entry.internalNumber}. Esta accion no se puede deshacer.`);

    if (!confirmed) {
      return;
    }

    const deleted = await deleteCase(entry.id);

    if (!deleted) {
      setAttachmentError("No pude eliminar el caso.");
      return;
    }

    router.push("/cases");
    router.refresh();
  };

  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="workspace-page-header-row">
          <div>
            <h1 className="workspace-title">{entry.internalNumber}</h1>
          </div>

          <div className="workspace-inline-actions">
            {canDeleteCases ? (
              <button className="workspace-button-secondary" type="button" onClick={handleDeleteCase}>
                Eliminar caso
              </button>
            ) : null}
            <Link className="workspace-button-secondary" href="/cases">
              Volver a abiertos
            </Link>
            <Link className="workspace-button-secondary" href="/closed-cases">
              Ver cerrados
            </Link>
          </div>
        </div>

        <div className="workspace-chip-row">
          <StatusPill kind="status" value={entry.externalStatus} />
          <StatusPill kind="sla" value={entry.slaDueAt} label={getSlaLabel(entry.slaDueAt)} />
          <span className="workspace-chip">{getPriorityLabel(entry.priority)}</span>
          <span className="workspace-chip">{getDeliveryModeLabel(entry.deliveryMode)}</span>
          <span className="workspace-chip">{entry.internalSubstatus}</span>
        </div>

        <p className="workspace-subtitle">
          {entry.clientName} / {entry.productDescription}. Responsable actual: {entry.owner}. Proxima accion: {entry.nextAction}
        </p>
      </header>

      <ModuleSubnav
        items={[
          { href: `/cases/${entry.id}?tab=resumen`, label: "Resumen", active: tab === "resumen" },
          { href: `/cases/${entry.id}?tab=cliente`, label: "Cliente", active: tab === "cliente" },
          { href: `/cases/${entry.id}?tab=producto`, label: "Producto", active: tab === "producto" },
          { href: `/cases/${entry.id}?tab=operacion`, label: "Operacion", active: tab === "operacion" },
          { href: `/cases/${entry.id}?tab=historial`, label: "Historial", active: tab === "historial" }
        ]}
        aside={
          <label className="workspace-label workspace-stage-dropdown">
            <span>Cambio de etapa</span>
            <CaseStatusSelect
              value={entry.externalStatus}
              zone={entry.zone}
              onChange={(status) => updateCaseStatus(entry.id, status)}
              disabled={!canManageCases}
            />
          </label>
        }
      />

      {tab === "resumen" ? (
        <>
          <section className="workspace-grid-4">
            <article className="workspace-panel space-y-3">
              <p className="workspace-kicker">Responsable</p>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/6 text-sm font-semibold text-white">
                  {getOwnerInitials(entry.owner)}
                </div>
                <div>
                  <div className="text-base font-semibold text-white">{entry.owner}</div>
                  <div className="text-sm text-white/58">{getTeamLabel(getOwnerRole(entry.owner))}</div>
                </div>
              </div>
            </article>

            <article className="workspace-panel space-y-3">
              <p className="workspace-kicker">Aging</p>
              <div className="text-4xl font-[var(--font-display)] tracking-[-0.06em] text-white">{getCaseAgingDays(entry)}d</div>
              <div className="text-sm text-white/58">Ingreso {formatDate(entry.openedAt)}</div>
            </article>

            <article className="workspace-panel space-y-3">
              <p className="workspace-kicker">Ticket Kingston</p>
              <div className="text-base font-semibold text-white">{entry.kingstonNumber}</div>
              <div className="text-sm text-white/58">Origen {getOriginLabel(entry.origin)}</div>
            </article>

            <article className="workspace-panel space-y-3">
              <p className="workspace-kicker">Ultimo movimiento</p>
              <div className="text-base font-semibold text-white">{formatDateTime(entry.updatedAt)}</div>
              <div className="text-sm text-white/58">{entry.internalSubstatus}</div>
            </article>
          </section>

          <div className="workspace-grid-2">
            <SectionPanel title="Resumen operativo" description="Lo esencial para entender rapido donde esta parado el caso.">
              <dl className="workspace-data-list">
                <div className="workspace-data-item">
                  <dt>Cliente</dt>
                  <dd>{entry.clientName}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>Direccion exacta</dt>
                  <dd>{buildCaseAddress(entry)}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>Producto y cantidad</dt>
                  <dd>
                    {entry.sku} / {entry.productDescription} / {entry.quantity} unidades
                  </dd>
                </div>
                <div className="workspace-data-item">
                  <dt>Falla reportada</dt>
                  <dd>{entry.failureDescription}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>Observaciones</dt>
                  <dd>{entry.observations}</dd>
                </div>
              </dl>
            </SectionPanel>

            <SectionPanel title="Asignacion y siguiente paso" description="Cambio de responsable y control de la accion pendiente.">
              <div className="workspace-inline-form">
                <label className="workspace-label">
                  <span>Responsable actual</span>
                  <select
                    className="workspace-select"
                    value={entry.owner}
                    onChange={(event) => assignCaseOwner(entry.id, event.target.value)}
                    disabled={!canManageCases}
                  >
                    {activeOwners.map((owner) => (
                      <option key={owner.id} value={owner.name}>
                        {owner.name}
                      </option>
                    ))}
                    <option value="Sin asignar">Sin asignar</option>
                  </select>
                </label>

                <div className="workspace-empty">
                  <strong className="block text-white">Proxima accion</strong>
                  <span className="mt-2 block text-white/68">{entry.nextAction}</span>
                </div>
              </div>
            </SectionPanel>
          </div>
        </>
      ) : null}

      {tab === "cliente" ? (
        <div className="workspace-grid-2">
          <SectionPanel title="Datos del cliente" description="Contacto y ubicacion completa de la operacion.">
            <dl className="workspace-data-list">
              <div className="workspace-data-item">
                <dt>Cliente</dt>
                <dd>{entry.clientName}</dd>
              </div>
              <div className="workspace-data-item">
                <dt>Contacto</dt>
                <dd>{entry.contactName}</dd>
              </div>
              <div className="workspace-data-item">
                <dt>Email</dt>
                <dd>{entry.contactEmail}</dd>
              </div>
              <div className="workspace-data-item">
                <dt>Telefono</dt>
                <dd>{entry.contactPhone}</dd>
              </div>
              <div className="workspace-data-item">
                <dt>Direccion completa</dt>
                <dd>{buildCaseAddress(entry)}</dd>
              </div>
              <div className="workspace-data-item">
                <dt>Zona</dt>
                <dd>{entry.zone}</dd>
              </div>
            </dl>
          </SectionPanel>

          <SectionPanel title="Datos bancarios" description="Informacion util para reintegros o validaciones administrativas.">
            {banking ? (
              <dl className="workspace-data-list">
                <div className="workspace-data-item">
                  <dt>Banco</dt>
                  <dd>{banking.bankName}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>Titular</dt>
                  <dd>{banking.accountHolder}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>CUIT</dt>
                  <dd>{banking.cuit}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>CBU</dt>
                  <dd>{banking.cbu}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>Alias</dt>
                  <dd>{banking.alias}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>Cuenta</dt>
                  <dd>{banking.accountNumber}</dd>
                </div>
              </dl>
            ) : (
              <div className="workspace-empty">Este caso todavia no tiene datos bancarios cargados.</div>
            )}
          </SectionPanel>
        </div>
      ) : null}

      {tab === "producto" ? (
        <div className="workspace-grid-2">
          <SectionPanel title="Producto y falla" description="Datos tecnicos para validar reemplazo, stock y catalogacion.">
            <dl className="workspace-data-list">
              <div className="workspace-data-item">
                <dt>SKU fallado</dt>
                <dd>{entry.sku}</dd>
              </div>
              <div className="workspace-data-item">
                <dt>Descripcion</dt>
                <dd>{entry.productDescription}</dd>
              </div>
              <div className="workspace-data-item">
                <dt>Cantidad</dt>
                <dd>{entry.quantity}</dd>
              </div>
              <div className="workspace-data-item">
                <dt>Falla informada</dt>
                <dd>{entry.failureDescription}</dd>
              </div>
            </dl>
          </SectionPanel>

          <SectionPanel title="Abastecimiento" description="Lectura completa de stock local, mayorista y dependencia con Kingston.">
            <div className="workspace-inline-form">
              <dl className="workspace-data-list">
                <div className="workspace-data-item">
                  <dt>Stock local</dt>
                  <dd>{getAvailabilityLabel(entry.procurement.localStock)}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>Stock mayorista</dt>
                  <dd>
                    {getAvailabilityLabel(entry.procurement.wholesalerStock)}
                    {entry.procurement.wholesalerName ? ` / ${entry.procurement.wholesalerName}` : ""}
                  </dd>
                </div>
                <div className="workspace-data-item">
                  <dt>Pedido a Kingston</dt>
                  <dd>{entry.procurement.requiresKingstonOrder ? "Si" : "No"}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>Fecha de solicitud</dt>
                  <dd>
                    {entry.procurement.kingstonRequestedAt
                      ? formatDateTime(entry.procurement.kingstonRequestedAt)
                      : "Sin solicitar"}
                  </dd>
                </div>
                <div className="workspace-data-item">
                  <dt>Arribo desde USA</dt>
                  <dd>
                    {entry.procurement.receivedFromUsaAt
                      ? formatDateTime(entry.procurement.receivedFromUsaAt)
                      : "Pendiente"}
                  </dd>
                </div>
              </dl>

              <label className="workspace-label">
                <span>SKU de reemplazo</span>
                <input
                  className="workspace-input"
                  value={replacementSkuDraft}
                  onChange={(event) => setReplacementSkuDraft(event.target.value)}
                  placeholder="Ej. KF556C40BBAK2-32"
                  disabled={!canManageCases}
                />
              </label>

              <div className="workspace-inline-actions">
                <button className="workspace-button" type="button" onClick={handleReplacementSkuSave} disabled={!canManageCases}>
                  Guardar SKU de reemplazo
                </button>
              </div>

              {replacementSuccess ? <div className="workspace-empty">{replacementSuccess}</div> : null}
            </div>
          </SectionPanel>
        </div>
      ) : null}

      {tab === "operacion" ? (
        <>
          <div className="workspace-grid-2">
            <SectionPanel title="Logistica" description="Retiro, envio, guia, tracking y entrega final.">
              <dl className="workspace-data-list">
                <div className="workspace-data-item">
                  <dt>Modalidad</dt>
                  <dd>{getDeliveryModeLabel(entry.logistics.mode)}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>Direccion logistica</dt>
                  <dd>{entry.logistics.address}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>Transportista</dt>
                  <dd>{entry.logistics.transporter ?? "Pendiente"}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>Numero de guia</dt>
                  <dd>{entry.logistics.guideNumber ?? "Sin cargar"}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>Tracking</dt>
                  <dd>{entry.logistics.trackingUrl ?? "Sin informar"}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>Despacho / entrega</dt>
                  <dd>
                    {(entry.logistics.dispatchDate && formatDateTime(entry.logistics.dispatchDate)) ?? "Sin despacho"} /{" "}
                    {(entry.logistics.deliveredDate && formatDateTime(entry.logistics.deliveredDate)) ?? "Sin entrega"}
                  </dd>
                </div>
                <div className="workspace-data-item">
                  <dt>Reintegro</dt>
                  <dd>{getReimbursementStateLabel(entry.logistics.reimbursementState)}</dd>
                </div>
              </dl>
            </SectionPanel>

            <SectionPanel title="Tareas del caso" description="Trabajo activo asociado a esta operacion.">
              <TaskList tasks={taskItems} emptyLabel="No hay tareas abiertas para este caso." />
            </SectionPanel>
          </div>

          <SectionPanel
            title="Reintegro y cliente"
            description="Resumen del comprobante, datos bancarios y accesos rapidos relacionados."
          >
            <div className="workspace-grid-2">
              <div className="workspace-inline-form">
                <div className="workspace-data-list">
                  <div className="workspace-data-item">
                    <dt>Estado del reintegro</dt>
                    <dd>{getReimbursementStateLabel(entry.logistics.reimbursementState)}</dd>
                  </div>
                  <div className="workspace-data-item">
                    <dt>Cliente</dt>
                    <dd>
                      {entry.clientName} / {entry.contactName}
                    </dd>
                  </div>
                  <div className="workspace-data-item">
                    <dt>Banco</dt>
                    <dd>{banking ? `${banking.bankName} / ${banking.alias}` : "Sin datos bancarios cargados."}</dd>
                  </div>
                </div>

                <div className="workspace-inline-actions">
                  <Link className="workspace-button-secondary" href={`/cases/${entry.id}?tab=cliente`}>
                    Ver datos del cliente
                  </Link>
                  <Link className="workspace-button-secondary" href={`/cases/${entry.id}?tab=historial`}>
                    Gestionar adjuntos
                  </Link>
                  <Link className="workspace-button-secondary" href="/reimbursements">
                    Ir a reintegros
                  </Link>
                </div>
              </div>

              <div>
                {latestProofAttachment?.previewUrl ? (
                  <div className="workspace-proof-preview">
                    {latestProofAttachment.mimeType === "application/pdf" ? (
                      <a
                        className="workspace-button-secondary"
                        href={latestProofAttachment.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir PDF
                      </a>
                    ) : (
                      <img
                        src={latestProofAttachment.previewUrl}
                        alt={`Comprobante ${latestProofAttachment.name}`}
                        className="workspace-proof-image"
                      />
                    )}
                    <div className="workspace-case-meta">
                      {latestProofAttachment.name} / {formatDateTime(latestProofAttachment.createdAt)}
                    </div>
                  </div>
                ) : (
                  <div className="workspace-empty">Todavia no hay imagen de comprobante cargada en este caso.</div>
                )}
              </div>
            </div>
          </SectionPanel>
        </>
      ) : null}

      {tab === "historial" ? (
        <>
          <div className="workspace-grid-2">
            <SectionPanel title="Adjuntos del caso" description="Ver, agregar o eliminar archivos segun la necesidad operativa.">
              <div className="workspace-inline-form">
                <label className="workspace-label">
                  <span>Agregar adjunto</span>
                  <input
                    className="workspace-file-input"
                    type="file"
                    onChange={handleAttachmentUpload}
                    disabled={isUploadingAttachment || !canManageCases}
                  />
                </label>

                {attachmentError ? <div className="workspace-empty">{attachmentError}</div> : null}
                {attachmentSuccess ? <div className="workspace-empty">{attachmentSuccess}</div> : null}

                {entry.attachments.length === 0 ? (
                  <div className="workspace-empty">No hay adjuntos cargados en este caso.</div>
                ) : (
                  <div className="space-y-3">
                    {entry.attachments.map((attachment) => (
                      <article key={attachment.id} className="workspace-list-card">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">{attachment.name}</div>
                            <div className="mt-1 text-sm text-white/58">
                              {getAttachmentKindLabel(attachment.kind)} / {attachment.sizeLabel}
                            </div>
                          </div>
                          <button
                            className="workspace-link-button workspace-link-button-danger"
                            type="button"
                            onClick={() => handleRemoveAttachment(attachment.id, attachment.name)}
                            disabled={!canManageCases}
                          >
                            Eliminar
                          </button>
                        </div>
                        {attachment.previewUrl ? (
                          <div className="mt-3">
                            <a
                              className="workspace-link-button"
                              href={attachment.previewUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Abrir adjunto
                            </a>
                          </div>
                        ) : null}
                        {attachment.previewUrl ? (
                          attachment.mimeType === "application/pdf" ? null : (
                          <div className="workspace-proof-preview mt-3">
                            <img
                              src={attachment.previewUrl}
                              alt={`Adjunto ${attachment.name}`}
                              className="workspace-proof-image"
                            />
                          </div>
                          )
                        ) : null}
                        <div className="mt-2 text-xs uppercase tracking-[0.16em] text-white/40">
                          {attachment.uploadedBy} / {formatDateTime(attachment.createdAt)}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </SectionPanel>

            <SectionPanel title="Comentarios y auditoria" description="Notas internas y acciones recientes sobre el caso.">
              <div className="space-y-3">
                {entry.comments.map((comment) => (
                  <article key={comment.id} className="workspace-list-card">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">{comment.author}</div>
                      <div className="text-xs uppercase tracking-[0.16em] text-white/40">
                        {comment.internal ? "Interno" : "Externo"} / {formatDateTime(comment.createdAt)}
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-white/68">{comment.body}</p>
                  </article>
                ))}
                {caseAudit.map((event) => (
                  <article key={event.id} className="workspace-list-card">
                    <div className="text-xs uppercase tracking-[0.16em] text-white/40">{formatDateTime(event.createdAt)}</div>
                    <div className="mt-2 text-sm font-semibold text-white">{event.actorName}</div>
                    <p className="mt-2 text-sm leading-7 text-white/68">{event.detail}</p>
                  </article>
                ))}
              </div>
            </SectionPanel>
          </div>

          <SectionPanel title="Timeline del caso" description="Secuencia completa de eventos y movimientos.">
            <EventTimeline events={entry.events} />
          </SectionPanel>
        </>
      ) : null}
    </div>
  );
}
