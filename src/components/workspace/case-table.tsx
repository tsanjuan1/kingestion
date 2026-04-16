import Link from "next/link";

import { StatusPill } from "@/components/workspace/status-pill";
import { formatDate, getCaseAgingDays, getSlaLabel } from "@/lib/kingston/helpers";
import type { KingstonCase } from "@/lib/kingston/types";

type CaseTableProps = {
  cases: KingstonCase[];
};

export function CaseTable({ cases }: CaseTableProps) {
  return (
    <div className="workspace-table-wrap">
      <table className="workspace-table">
        <thead>
          <tr>
            <th>Case</th>
            <th>Client</th>
            <th>SKU</th>
            <th>Status</th>
            <th>Owner</th>
            <th>Next action</th>
            <th>SLA</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((entry) => (
            <tr key={entry.id}>
              <td>
                <Link className="font-semibold text-white transition hover:text-[#8de7dc]" href={`/cases/${entry.id}`}>
                  {entry.internalNumber}
                </Link>
                <div className="mt-1 text-xs uppercase tracking-[0.14em] text-white/36">{entry.kingstonNumber}</div>
              </td>
              <td>
                <div className="font-medium text-white">{entry.clientName}</div>
                <div className="mt-1 text-sm text-white/54">
                  {entry.zone} / {entry.deliveryMode}
                </div>
              </td>
              <td>
                <div className="font-medium text-white">{entry.sku}</div>
                <div className="mt-1 text-sm text-white/54">
                  Qty {entry.quantity} / {getCaseAgingDays(entry)}d aging
                </div>
              </td>
              <td>
                <StatusPill kind="status" value={entry.externalStatus} />
                <div className="mt-2 text-sm text-white/54">{entry.internalSubstatus}</div>
              </td>
              <td>
                <div className="font-medium text-white">{entry.owner}</div>
                <div className="mt-1 text-sm text-white/54">Updated {formatDate(entry.updatedAt)}</div>
              </td>
              <td>
                <div className="max-w-[18rem] text-sm leading-7 text-white/72">{entry.nextAction}</div>
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
