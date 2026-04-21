"use client";

import { CaseTable } from "@/components/workspace/case-table";
import { SectionPanel } from "@/components/workspace/section-panel";
import { useKingestion } from "@/components/workspace/kingestion-provider";
import { getPendingPurchasesCases, getPendingTechnicalCases } from "@/lib/kingston/helpers";

type SectorQueueModuleProps = {
  type: "purchases" | "technical";
};

export function SectorQueueModule({ type }: SectorQueueModuleProps) {
  const { cases, updateCaseStatus, canAccessModule, canManageModule } = useKingestion();
  const moduleKey = type === "purchases" ? "pending-purchases" : "pending-service";
  const canManageCases = canManageModule("open-cases");

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
        <CaseTable
          cases={sortedCases}
          onStatusChange={updateCaseStatus}
          disableStatusChange={!canManageCases}
          emptyLabel={
            type === "purchases"
              ? "No hay casos pendientes de compras."
              : "No hay casos pendientes de servicio tecnico."
          }
        />
      </SectionPanel>
    </div>
  );
}
