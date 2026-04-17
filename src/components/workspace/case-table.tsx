import Link from "next/link";

import { CaseStatusSelect } from "@/components/workspace/case-status-select";
import { formatDate } from "@/lib/kingston/helpers";
import type { ExternalStatus, KingstonCase } from "@/lib/kingston/types";

type CaseTableProps = {
  cases: KingstonCase[];
  emptyLabel?: string;
  onStatusChange: (caseId: string, status: ExternalStatus) => void;
};

export function CaseTable({
  cases,
  emptyLabel = "No hay casos para mostrar en este modulo.",
  onStatusChange
}: CaseTableProps) {
  if (cases.length === 0) {
    return <div className="workspace-empty">{emptyLabel}</div>;
  }

  return (
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
          </tr>
        </thead>
        <tbody>
          {cases.map((entry) => (
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
                <CaseStatusSelect value={entry.externalStatus} onChange={(status) => onStatusChange(entry.id, status)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
