import Link from "next/link";

import { StatusPill } from "@/components/workspace/status-pill";
import {
  formatDate,
  getCaseAgingDays,
  getDeliveryModeLabel,
  getSlaLabel
} from "@/lib/kingston/helpers";
import type { KingstonCase } from "@/lib/kingston/types";

type CaseTableProps = {
  cases: KingstonCase[];
};

export function CaseTable({ cases }: CaseTableProps) {
  if (cases.length === 0) {
    return <div className="workspace-empty">No hay casos para los filtros seleccionados.</div>;
  }

  return (
    <div className="workspace-table-wrap">
      <table className="workspace-table">
        <thead>
          <tr>
            <th>Caso</th>
            <th>Cliente</th>
            <th>SKU</th>
            <th>Estado</th>
            <th>Responsable</th>
            <th>Proxima accion</th>
            <th>SLA</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((entry) => (
            <tr key={entry.id}>
              <td>
                <Link className="font-semibold text-white transition hover:text-[#7dd3fc]" href={`/cases/${entry.id}`}>
                  {entry.internalNumber}
                </Link>
                <div className="mt-1 text-xs uppercase tracking-[0.14em] text-white/38">{entry.kingstonNumber}</div>
              </td>
              <td>
                <div className="font-medium text-white">{entry.clientName}</div>
                <div className="mt-1 text-sm text-white/58">
                  {entry.zone} / {getDeliveryModeLabel(entry.deliveryMode)}
                </div>
              </td>
              <td>
                <div className="font-medium text-white">{entry.sku}</div>
                <div className="mt-1 text-sm text-white/58">
                  {entry.quantity} un. / {getCaseAgingDays(entry)} dias
                </div>
              </td>
              <td>
                <StatusPill kind="status" value={entry.externalStatus} />
                <div className="mt-2 text-sm text-white/58">{entry.internalSubstatus}</div>
              </td>
              <td>
                <div className="font-medium text-white">{entry.owner}</div>
                <div className="mt-1 text-sm text-white/58">Actualizado {formatDate(entry.updatedAt)}</div>
              </td>
              <td>
                <div className="max-w-[18rem] text-sm leading-7 text-white/74">{entry.nextAction}</div>
              </td>
              <td>
                <StatusPill kind="sla" value={entry.slaDueAt} label={getSlaLabel(entry.slaDueAt)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
