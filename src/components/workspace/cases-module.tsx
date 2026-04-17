"use client";

import Link from "next/link";

import { CaseTable } from "@/components/workspace/case-table";
import { SectionPanel } from "@/components/workspace/section-panel";
import { useKingestion } from "@/components/workspace/kingestion-provider";

type CasesModuleProps = {
  mode: "open" | "closed";
};

export function CasesModule({ mode }: CasesModuleProps) {
  const { openCases, closedCases, updateCaseStatus } = useKingestion();
  const cases = (mode === "open" ? openCases : closedCases).toSorted(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
  const isOpenView = mode === "open";

  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="workspace-page-header-row">
          <div>
            <p className="workspace-kicker">Casos</p>
            <h1 className="workspace-title">{isOpenView ? "Casos abiertos" : "Casos cerrados"}</h1>
          </div>

          <div className="workspace-chip-row">
            {isOpenView ? (
              <Link className="workspace-button" href="/cases/new">
                Nuevo caso
              </Link>
            ) : null}
          </div>
        </div>
        <p className="workspace-subtitle">
          {isOpenView
            ? `${cases.length} casos en la bandeja operativa activa.`
            : `${cases.length} casos archivados por realizado o cerrado.`}
        </p>
      </header>

      <SectionPanel
        title={isOpenView ? "Listado de abiertos" : "Listado de cerrados"}
        description="Vista operativa simple con los datos clave del caso y cambio de estado directo."
      >
        <CaseTable
          cases={cases}
          onStatusChange={updateCaseStatus}
          emptyLabel={isOpenView ? "No hay casos abiertos en este momento." : "No hay casos cerrados para mostrar."}
        />
      </SectionPanel>
    </div>
  );
}
