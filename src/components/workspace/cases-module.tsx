"use client";

import Link from "next/link";

import { CaseTable } from "@/components/workspace/case-table";
import { SectionPanel } from "@/components/workspace/section-panel";
import { useKingestion } from "@/components/workspace/kingestion-provider";

type CasesModuleProps = {
  mode: "open" | "closed";
};

export function CasesModule({ mode }: CasesModuleProps) {
  const { openCases, closedCases, updateCaseStatus, canAccessModule, canManageModule } = useKingestion();
  const cases = (mode === "open" ? openCases : closedCases).toSorted(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
  const isOpenView = mode === "open";
  const moduleKey = isOpenView ? "open-cases" : "closed-cases";
  const canManageCases = canManageModule("open-cases");

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
        title={isOpenView ? "Bandeja activa" : "Archivo de casos"}
        description={
          isOpenView
            ? "Solo los casos abiertos con su informacion clave y cambio de estado directo."
            : "Solo los casos realizados o cerrados."
        }
        aside={
          isOpenView ? (
            <Link className="workspace-button" href="/cases/new">
              Nuevo caso
            </Link>
          ) : undefined
        }
      >
        <CaseTable
          cases={cases}
          onStatusChange={updateCaseStatus}
          disableStatusChange={!canManageCases}
          emptyLabel={isOpenView ? "No hay casos abiertos en este momento." : "No hay casos cerrados para mostrar."}
        />
      </SectionPanel>
    </div>
  );
}
