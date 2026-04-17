import Link from "next/link";
import { notFound } from "next/navigation";

import { EventTimeline } from "@/components/workspace/event-timeline";
import { ModuleSubnav } from "@/components/workspace/module-subnav";
import { SectionPanel } from "@/components/workspace/section-panel";
import { StatusPill } from "@/components/workspace/status-pill";
import { TaskList } from "@/components/workspace/task-list";
import { transitionRules } from "@/lib/kingston/data";
import {
  formatDate,
  formatDateTime,
  getAttachmentKindLabel,
  getAvailabilityLabel,
  getCaseAgingDays,
  getCaseById,
  getDeliveryModeLabel,
  getOriginLabel,
  getOwnerInitials,
  getOwnerTeam,
  getPriorityLabel,
  getReimbursementStateLabel,
  getSlaLabel,
  getTeamLabel
} from "@/lib/kingston/helpers";

type CaseDetailPageProps = {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CaseDetailPage({ params, searchParams }: CaseDetailPageProps) {
  const { caseId } = await params;
  const resolved = await searchParams;
  const tab = Array.isArray(resolved.tab) ? resolved.tab[0] : resolved.tab ?? "resumen";
  const entry = getCaseById(caseId);

  if (!entry) {
    notFound();
  }

  const nextTransitions = transitionRules.filter((rule) => rule.from === entry.externalStatus);
  const taskItems = entry.tasks.map((task) => ({
    ...task,
    caseId: entry.id,
    caseNumber: entry.internalNumber,
    clientName: entry.clientName
  }));
  const caseTabs = [
    { href: `/cases/${entry.id}?tab=resumen`, label: "Resumen", active: tab === "resumen" },
    { href: `/cases/${entry.id}?tab=cliente`, label: "Cliente", active: tab === "cliente" },
    { href: `/cases/${entry.id}?tab=producto`, label: "Producto", active: tab === "producto" },
    { href: `/cases/${entry.id}?tab=operacion`, label: "Operacion", active: tab === "operacion" },
    { href: `/cases/${entry.id}?tab=historial`, label: "Historial", active: tab === "historial" }
  ];

  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="workspace-page-header-row">
          <div>
            <p className="workspace-kicker">Casos</p>
            <h1 className="workspace-title">{entry.internalNumber}</h1>
          </div>

          <div className="workspace-chip-row">
            <Link className="workspace-button-secondary" href="/cases">
              Volver a la bandeja
            </Link>
            <Link className="workspace-button" href="/tasks">
              Ir a tareas
            </Link>
          </div>
        </div>

        <div className="workspace-chip-row">
          <StatusPill kind="status" value={entry.externalStatus} />
          <StatusPill kind="sla" value={entry.slaDueAt} label={getSlaLabel(entry.slaDueAt)} />
          <span className="workspace-chip">{getPriorityLabel(entry.priority)}</span>
          <span className="workspace-chip">{getDeliveryModeLabel(entry.deliveryMode)}</span>
        </div>

        <p className="workspace-subtitle">
          {entry.clientName} / {entry.productDescription}. El responsable actual es {entry.owner} ({getTeamLabel(getOwnerTeam(entry.owner))}) y el subestado activo es {entry.internalSubstatus}.
        </p>
      </header>

      <ModuleSubnav items={caseTabs} />

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
                  <div className="text-sm text-white/58">{getTeamLabel(getOwnerTeam(entry.owner))}</div>
                </div>
              </div>
            </article>

            <article className="workspace-panel space-y-3">
              <p className="workspace-kicker">Proxima accion</p>
              <div className="text-base font-semibold text-white">{entry.nextAction}</div>
              <div className="text-sm text-white/58">Actualizado {formatDateTime(entry.updatedAt)}</div>
            </article>

            <article className="workspace-panel space-y-3">
              <p className="workspace-kicker">Aging</p>
              <div className="text-4xl font-[var(--font-display)] tracking-[-0.06em] text-white">{getCaseAgingDays(entry)}d</div>
              <div className="text-sm text-white/58">Abierto {formatDate(entry.openedAt)}</div>
            </article>

            <article className="workspace-panel space-y-3">
              <p className="workspace-kicker">Ticket Kingston</p>
              <div className="text-base font-semibold text-white">{entry.kingstonNumber}</div>
              <div className="text-sm text-white/58">Origen {getOriginLabel(entry.origin)}</div>
            </article>
          </section>

          <div className="workspace-grid-2">
            <SectionPanel title="Resumen del caso" description="Datos esenciales para ubicar el caso dentro de la operacion.">
              <dl className="workspace-data-list">
                <div className="workspace-data-item">
                  <dt>Cliente</dt>
                  <dd>{entry.clientName}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>SKU</dt>
                  <dd>{entry.sku}</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>Cantidad</dt>
                  <dd>{entry.quantity} unidades</dd>
                </div>
                <div className="workspace-data-item">
                  <dt>Zona y modalidad</dt>
                  <dd>
                    {entry.zone} / {getDeliveryModeLabel(entry.deliveryMode)}
                  </dd>
                </div>
                <div className="workspace-data-item">
                  <dt>Observaciones</dt>
                  <dd>{entry.observations}</dd>
                </div>
              </dl>
            </SectionPanel>

            <SectionPanel title="Transiciones validas" description="Siguientes movimientos permitidos para este estado.">
              <div className="space-y-3">
                {nextTransitions.length > 0 ? (
                  nextTransitions.map((rule) => (
                    <article key={`${rule.from}-${rule.to}`} className="rounded-[1rem] border border-white/10 bg-white/4 px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="workspace-chip">{rule.from}</span>
                        <span className="text-sm text-white/58">a</span>
                        <span className="workspace-chip workspace-chip-active">{rule.to}</span>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-white/66">{rule.note}</p>
                    </article>
                  ))
                ) : (
                  <div className="workspace-empty">No hay una transicion configurada para este estado.</div>
                )}
              </div>
            </SectionPanel>
          </div>
        </>
      ) : null}

      {tab === "cliente" ? (
        <SectionPanel title="Datos del cliente" description="Contacto y ubicacion para seguimiento y entrega.">
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
              <dt>Direccion</dt>
              <dd>
                {entry.address}, {entry.city}, {entry.province}
              </dd>
            </div>
            <div className="workspace-data-item">
              <dt>Zona</dt>
              <dd>{entry.zone}</dd>
            </div>
          </dl>
        </SectionPanel>
      ) : null}

      {tab === "producto" ? (
        <div className="workspace-grid-2">
          <SectionPanel title="Producto y falla" description="Detalle tecnico para validar reemplazo, catalogacion y seguimiento.">
            <dl className="workspace-data-list">
              <div className="workspace-data-item">
                <dt>SKU</dt>
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

          <SectionPanel title="Abastecimiento" description="Disponibilidad local, mayorista y dependencia con Kingston.">
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
                <dt>Solicitud enviada</dt>
                <dd>{entry.procurement.kingstonRequestedAt ? formatDateTime(entry.procurement.kingstonRequestedAt) : "Sin enviar"}</dd>
              </div>
              <div className="workspace-data-item">
                <dt>Arribo desde USA</dt>
                <dd>{entry.procurement.receivedFromUsaAt ? formatDateTime(entry.procurement.receivedFromUsaAt) : "Pendiente"}</dd>
              </div>
            </dl>
          </SectionPanel>
        </div>
      ) : null}

      {tab === "operacion" ? (
        <div className="workspace-grid-2">
        <SectionPanel title="Logistica" description="Ultima milla del caso: retiro, envio, guia y seguimiento.">
            <dl className="workspace-data-list">
              <div className="workspace-data-item">
                <dt>Modalidad</dt>
                <dd>{getDeliveryModeLabel(entry.logistics.mode)}</dd>
              </div>
              <div className="workspace-data-item">
                <dt>Direccion de entrega</dt>
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
                <dt>Despacho y entrega</dt>
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

          <SectionPanel title="Tareas del caso" description="Trabajo abierto asociado al caso actual.">
            <TaskList tasks={taskItems} emptyLabel="No hay tareas abiertas para este caso." />
          </SectionPanel>
        </div>
      ) : null}

      {tab === "historial" ? (
        <>
          <div className="workspace-grid-2">
            <SectionPanel title="Adjuntos" description="Documentos y evidencias cargadas sobre el caso.">
              <div className="space-y-3">
                {entry.attachments.map((attachment) => (
                  <article key={attachment.id} className="rounded-[1rem] border border-white/10 bg-white/4 px-4 py-4">
                    <div className="text-sm font-semibold text-white">{attachment.name}</div>
                    <div className="mt-1 text-sm text-white/58">
                      {getAttachmentKindLabel(attachment.kind)} / {attachment.sizeLabel}
                    </div>
                    <div className="mt-2 text-xs uppercase tracking-[0.16em] text-white/40">
                      {attachment.uploadedBy} / {formatDateTime(attachment.createdAt)}
                    </div>
                  </article>
                ))}
              </div>
            </SectionPanel>

            <SectionPanel title="Comentarios" description="Notas internas y seguimiento operativo.">
              <div className="space-y-3">
                {entry.comments.map((comment) => (
                  <article key={comment.id} className="rounded-[1rem] border border-white/10 bg-white/4 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">{comment.author}</div>
                      <div className="text-xs uppercase tracking-[0.16em] text-white/40">
                        {comment.internal ? "Interno" : "Externo"} / {formatDateTime(comment.createdAt)}
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-white/68">{comment.body}</p>
                  </article>
                ))}
              </div>
            </SectionPanel>
          </div>

          <SectionPanel title="Historial del caso" description="Registro cronologico de cambios, tareas y eventos operativos.">
            <EventTimeline events={entry.events} />
          </SectionPanel>
        </>
      ) : null}
    </div>
  );
}
