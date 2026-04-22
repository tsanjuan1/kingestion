"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { CaseTable } from "@/components/workspace/case-table";
import { ModuleSubnav } from "@/components/workspace/module-subnav";
import { SectionPanel } from "@/components/workspace/section-panel";
import { useKingestion } from "@/components/workspace/kingestion-provider";

type CasesModuleProps = {
  mode: "open" | "closed";
};

export function CasesModule({ mode }: CasesModuleProps) {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "archivados" ? "archivados" : "cerrados";
  const { openCases, closedCases, archivedCases, updateCaseStatus, restoreCase, canAccessModule, canManageModule, canArchiveCases } =
    useKingestion();
  const cases = (mode === "open" ? openCases : closedCases).toSorted(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
  const archived = archivedCases.toSorted((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
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
      {!isOpenView && canArchiveCases ? (
        <ModuleSubnav
          items={[
            { href: "/closed-cases", label: "Cerrados", active: view === "cerrados" },
            { href: "/closed-cases?view=archivados", label: "Archivados", active: view === "archivados" }
          ]}
        />
      ) : null}

      <SectionPanel
        title={
          isOpenView ? "Bandeja activa" : view === "archivados" ? "Casos archivados" : "Archivo de casos"
        }
        description={
          isOpenView
            ? "Solo los casos abiertos con su informacion clave y cambio de estado directo."
            : view === "archivados"
              ? "Casos archivados por administracion y fuera de las bandejas operativas."
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
        {!isOpenView && view === "archivados" ? (
          archived.length === 0 ? (
            <div className="workspace-empty">No hay casos archivados para mostrar.</div>
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
                    <th>Archivado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {archived.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <Link className="workspace-case-link" href={`/cases/${entry.id}`}>
                          {entry.internalNumber}
                        </Link>
                        <div className="workspace-case-meta">{entry.kingstonNumber}</div>
                      </td>
                      <td>
                        <div className="font-medium text-white">
                          {new Intl.DateTimeFormat("es-AR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric"
                          }).format(new Date(entry.openedAt))}
                        </div>
                        <div className="workspace-case-meta">
                          {entry.archivedAt
                            ? `Archivado ${new Intl.DateTimeFormat("es-AR", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit"
                              }).format(new Date(entry.archivedAt))}`
                            : "Sin fecha"}
                        </div>
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
                        <div className="font-medium text-white">{entry.archivedBy ?? "Administrador"}</div>
                      </td>
                      <td>
                        <div className="workspace-inline-actions">
                          <button className="workspace-link-button" type="button" onClick={() => void restoreCase(entry.id)}>
                            Restaurar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <CaseTable
            cases={cases}
            onStatusChange={updateCaseStatus}
            disableStatusChange={!canManageCases}
            emptyLabel={isOpenView ? "No hay casos abiertos en este momento." : "No hay casos cerrados para mostrar."}
          />
        )}
      </SectionPanel>
    </div>
  );
}
