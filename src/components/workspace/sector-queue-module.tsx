"use client";

import Link from "next/link";

import { SectionPanel } from "@/components/workspace/section-panel";
import { useKingestion } from "@/components/workspace/kingestion-provider";
import {
  formatDate,
  getNextQueueCompletionStatus,
  getPendingPurchasesCases,
  getPendingTechnicalCases
} from "@/lib/kingston/helpers";

type SectorQueueModuleProps = {
  type: "purchases" | "technical";
};

export function SectorQueueModule({ type }: SectorQueueModuleProps) {
  const { cases, completeQueueStep, canAccessModule, canManageModule } = useKingestion();
  const moduleKey = type === "purchases" ? "pending-purchases" : "pending-service";
  const canManageQueue = canManageModule(moduleKey);

  const queueCases =
    type === "purchases"
      ? getPendingPurchasesCases(cases)
      : getPendingTechnicalCases(cases);

  const sortedCases = queueCases.toSorted(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );

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
            ? "Casos que entran a compras cuando quedan en Liberar mercaderia u OV creada."
            : "Casos que entran a servicio tecnico cuando quedan Informados o en Pedido deposito y etiquetado."
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
                  const nextStatus = getNextQueueCompletionStatus(entry);

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
                          {nextStatus ? `Siguiente: ${nextStatus}` : "Sin siguiente etapa automatica"}
                        </div>
                      </td>
                      <td>
                        <button
                          className="workspace-link-button"
                          type="button"
                          onClick={() => void completeQueueStep(entry.id)}
                          disabled={!canManageQueue || !nextStatus}
                        >
                          Completar
                        </button>
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
