"use client";

import Link from "next/link";

import { SectionPanel } from "@/components/workspace/section-panel";
import { useKingestion } from "@/components/workspace/kingestion-provider";
import {
  formatDate,
  formatDateTime,
  getPendingReimbursements,
  getReimbursementStateLabel
} from "@/lib/kingston/helpers";

export function ReimbursementsModule() {
  const { openCases, canManageReimbursements, completeReimbursement, activeOwner } = useKingestion();
  const pendingCases = getPendingReimbursements(openCases).toSorted(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );

  return (
    <div className="workspace-page">
      <SectionPanel
        title="Pendientes para cierre de reintegro"
        description={
          canManageReimbursements
            ? "Podes revisar comprobantes y marcar el reintegro como completado."
            : `Solo Compras o Gerencia pueden cerrar reintegros. Sesion actual: ${activeOwner?.name ?? "sin responsable activo"}.`
        }
      >
        {pendingCases.length === 0 ? (
          <div className="workspace-empty">No hay reintegros pendientes en este momento.</div>
        ) : (
          <div className="workspace-reimbursements-list">
            {pendingCases.map((entry) => {
              const proofAttachment = entry.attachments.find(
                (attachment) => attachment.previewUrl || attachment.kind === "proof" || attachment.kind === "photo"
              );

              return (
                <article key={entry.id} className="workspace-reimbursement-card">
                  <div className="workspace-reimbursement-main">
                    <div className="workspace-reimbursement-header">
                      <div>
                        <div className="workspace-kicker">Caso {entry.internalNumber}</div>
                        <h2 className="workspace-reimbursement-title">{entry.clientName}</h2>
                        <p className="workspace-case-meta">
                          {entry.sku} / {entry.zone} / Ingreso {formatDate(entry.openedAt)}
                        </p>
                      </div>

                      <div className="workspace-chip">
                        {getReimbursementStateLabel(entry.logistics.reimbursementState)}
                      </div>
                    </div>

                    <div className="workspace-reimbursement-grid">
                      <div className="workspace-data-item">
                        <dt>Contacto</dt>
                        <dd>
                          {entry.contactName} / {entry.contactEmail} / {entry.contactPhone}
                        </dd>
                      </div>
                      <div className="workspace-data-item">
                        <dt>Direccion</dt>
                        <dd>{entry.logistics.address}</dd>
                      </div>
                      <div className="workspace-data-item">
                        <dt>Banco</dt>
                        <dd>{entry.banking?.bankName ?? "Sin datos bancarios"}</dd>
                      </div>
                      <div className="workspace-data-item">
                        <dt>Alias / CBU</dt>
                        <dd>
                          {entry.banking ? `${entry.banking.alias} / ${entry.banking.cbu}` : "Sin datos bancarios"}
                        </dd>
                      </div>
                    </div>

                    <div className="workspace-inline-actions">
                      <Link className="workspace-button-secondary" href={`/cases/${entry.id}?tab=cliente`}>
                        Ver datos del cliente
                      </Link>
                      <Link className="workspace-button-secondary" href={`/cases/${entry.id}?tab=operacion`}>
                        Ver operacion
                      </Link>
                      <Link className="workspace-button-secondary" href={`/cases/${entry.id}?tab=historial`}>
                        Ver adjuntos
                      </Link>
                      <button
                        className="workspace-button"
                        type="button"
                        onClick={() => completeReimbursement(entry.id)}
                        disabled={!canManageReimbursements}
                      >
                        Marcar reintegro completado
                      </button>
                    </div>
                  </div>

                  <aside className="workspace-reimbursement-proof">
                    <div className="workspace-kicker">Comprobante</div>
                    {proofAttachment?.previewUrl ? (
                      <div className="workspace-proof-preview">
                        <img
                          src={proofAttachment.previewUrl}
                          alt={`Comprobante ${proofAttachment.name}`}
                          className="workspace-proof-image"
                        />
                        <div className="workspace-case-meta">
                          {proofAttachment.name} / {formatDateTime(proofAttachment.createdAt)}
                        </div>
                      </div>
                    ) : proofAttachment ? (
                      <div className="workspace-empty">
                        <strong className="block text-white">{proofAttachment.name}</strong>
                        <span className="mt-2 block text-white/68">
                          {proofAttachment.sizeLabel} / {formatDateTime(proofAttachment.createdAt)}
                        </span>
                      </div>
                    ) : (
                      <div className="workspace-empty">Todavia no hay comprobante de cliente cargado.</div>
                    )}
                  </aside>
                </article>
              );
            })}
          </div>
        )}
      </SectionPanel>
    </div>
  );
}
