"use client";

import { useState } from "react";
import Link from "next/link";

import { SectionPanel } from "@/components/workspace/section-panel";
import { useKingestion } from "@/components/workspace/kingestion-provider";
import {
  formatDate,
  getQueueCompletionOptions,
  getPendingPurchasesCases,
  getPendingTechnicalCases
} from "@/lib/kingston/helpers";
import type { ExternalStatus } from "@/lib/kingston/types";

type SectorQueueModuleProps = {
  type: "purchases" | "technical";
};

export function SectorQueueModule({ type }: SectorQueueModuleProps) {
  const { cases, completeQueueStep, canAccessModule, canManageModule } = useKingestion();
  const [queueDrafts, setQueueDrafts] = useState<
    Record<string, { nextStatus?: ExternalStatus; guideNumber?: string }>
  >({});
  const moduleKey = type === "purchases" ? "pending-purchases" : "pending-service";
  const canManageQueue = canManageModule(moduleKey);

  const queueCases =
    type === "purchases"
      ? getPendingPurchasesCases(cases)
      : getPendingTechnicalCases(cases);

  const sortedCases = queueCases.toSorted(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );

  const updateDraft = (caseId: string, nextPartial: { nextStatus?: ExternalStatus; guideNumber?: string }) => {
    setQueueDrafts((current) => ({
      ...current,
      [caseId]: {
        ...current[caseId],
        ...nextPartial
      }
    }));
  };

  if (!canAccessModule(moduleKey)) {
    return (
      <div className="workspace-page">
        <SectionPanel title="Sin permisos" description="Tu usuario no tiene acceso a este modulo.">
          <div className="workspace-empty">Pedi al administrador que revise tus permisos.</div>
        </SectionPanel>
      </div>
    );
  }

  return (
    <div className="workspace-page">
      <SectionPanel
        title={type === "purchases" ? "Bandeja de compras" : "Bandeja de servicio tecnico"}
        description={
          type === "purchases"
            ? "Casos que quedan pendientes de compras en OV creada, Pedido Kingston o estados legacy de liberacion."
            : "Casos que entran a servicio tecnico cuando quedan informados o en pedido de deposito y etiquetado."
        }
      >
        {sortedCases.length === 0 ? (
          <div className="workspace-empty">
            {type === "purchases"
              ? "No hay casos pendientes de compras."
              : "No hay casos pendientes de servicio tecnico."}
          </div>
        ) : (
          <div className="workspace-table-wrap">
            <table className="workspace-table workspace-case-list-table">
              <thead>
                <tr>
                  <th>Numero de caso</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>SKU fallado</th>
                  <th>Zona</th>
                  <th>Estado</th>
                  <th>Completado</th>
                </tr>
              </thead>
              <tbody>
                {sortedCases.map((entry) => {
                  const nextOptions = getQueueCompletionOptions(entry);
                  const selectedNextStatus =
                    queueDrafts[entry.id]?.nextStatus && nextOptions.includes(queueDrafts[entry.id]!.nextStatus!)
                      ? queueDrafts[entry.id]!.nextStatus
                      : nextOptions[0];
                  const showStatusSelector = nextOptions.length > 1;
                  const showGuideInput =
                    type === "technical" &&
                    entry.zone === "Interior / Gran Buenos Aires" &&
                    entry.externalStatus === "Pedido deposito y etiquetado" &&
                    selectedNextStatus === "Producto enviado";
                  const guideNumberValue = queueDrafts[entry.id]?.guideNumber ?? entry.logistics.guideNumber ?? "";

                  return (
                    <tr key={entry.id}>
                      <td>
                        <Link className="workspace-case-link" href={`/cases/${entry.id}`}>
                          {entry.internalNumber}
                        </Link>
                        <div className="workspace-case-meta">{entry.kingstonNumber}</div>
                      </td>
                      <td>
                        <div className="font-medium text-white">{formatDate(entry.openedAt)}</div>
                        <div className="workspace-case-meta">Actualizado {formatDate(entry.updatedAt)}</div>
                      </td>
                      <td>
                        <div className="font-medium text-white">{entry.clientName}</div>
                        <div className="workspace-case-meta">{entry.owner}</div>
                      </td>
                      <td>
                        <div className="font-medium text-white">{entry.sku}</div>
                        <div className="workspace-case-meta">{entry.productDescription}</div>
                      </td>
                      <td>
                        <div className="font-medium text-white">{entry.zone}</div>
                      </td>
                      <td>
                        <div className="font-medium text-white">{entry.externalStatus}</div>
                        <div className="workspace-case-meta">
                          {nextOptions.length > 1
                            ? `Siguientes posibles: ${nextOptions.join(" / ")}`
                            : selectedNextStatus
                              ? `Siguiente: ${selectedNextStatus}`
                              : "Sin siguiente etapa automatica"}
                        </div>
                      </td>
                      <td>
                        <div className="workspace-inline-form workspace-queue-actions">
                          {showStatusSelector ? (
                            <label className="workspace-label">
                              <span>Proximo estado</span>
                              <select
                                className="workspace-select"
                                value={selectedNextStatus ?? ""}
                                onChange={(event) =>
                                  updateDraft(entry.id, {
                                    nextStatus: event.target.value as ExternalStatus
                                  })
                                }
                                disabled={!canManageQueue}
                              >
                                {nextOptions.map((status) => (
                                  <option key={status} value={status}>
                                    {status}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : null}

                          {showGuideInput ? (
                            <label className="workspace-label">
                              <span>Numero de guia</span>
                              <input
                                className="workspace-input"
                                value={guideNumberValue}
                                onChange={(event) =>
                                  updateDraft(entry.id, {
                                    guideNumber: event.target.value
                                  })
                                }
                                placeholder="Cargar ahora o despues"
                                disabled={!canManageQueue}
                              />
                            </label>
                          ) : null}

                          <button
                            className="workspace-link-button"
                            type="button"
                            onClick={() =>
                              void completeQueueStep(entry.id, {
                                nextStatus: selectedNextStatus,
                                guideNumber: showGuideInput ? guideNumberValue : undefined
                              })
                            }
                            disabled={!canManageQueue || !selectedNextStatus}
                          >
                            Completar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionPanel>
    </div>
  );
}
