import Link from "next/link";

import { MetricCard } from "@/components/workspace/metric-card";
import { SectionPanel } from "@/components/workspace/section-panel";
import { formatCount, getDashboardSnapshot, getReportsSnapshot } from "@/lib/kingston/helpers";

export default function ReportsPage() {
  const snapshot = getDashboardSnapshot();
  const reports = getReportsSnapshot();
  const maxStatus = Math.max(...snapshot.byStatus.map((entry) => entry.count), 1);
  const maxZone = Math.max(...snapshot.byZone.map((entry) => entry.value), 1);
  const maxClient = Math.max(...reports.byClient.map((entry) => entry.value), 1);
  const maxSku = Math.max(...reports.bySku.map((entry) => entry.value), 1);

  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="workspace-page-header-row">
          <div>
            <p className="workspace-kicker">Reports</p>
            <h1 className="workspace-title">Throughput and aging</h1>
          </div>

          <div className="workspace-chip-row">
            <Link className="workspace-button-secondary" href="/dashboard">
              Back to dashboard
            </Link>
            <button className="workspace-button" type="button">
              Prepare export pack
            </button>
          </div>
        </div>
        <p className="workspace-subtitle">
          This first reporting surface already separates queue health, terminal outcomes, zone load and SKU concentration, which is enough to start operating with managerial visibility instead of spreadsheets.
        </p>
      </header>

      <section className="workspace-grid-4">
        {reports.throughput.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={formatCount(metric.value)} hint={metric.hint} />
        ))}
      </section>

      <div className="workspace-grid-2">
        <SectionPanel title="Status distribution" description="Open load by operating state, useful to see where work accumulates.">
          <div className="space-y-4">
            {snapshot.byStatus.map((entry) => (
              <article key={entry.status}>
                <div className="flex items-center justify-between text-sm text-white/68">
                  <span>{entry.status}</span>
                  <span>{formatCount(entry.count)}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/6">
                  <div
                    className="h-2 rounded-full bg-[linear-gradient(90deg,#8de7dc_0%,#7bd691_100%)]"
                    style={{ width: `${(entry.count / maxStatus) * 100}%` }}
                  />
                </div>
              </article>
            ))}
          </div>
        </SectionPanel>

        <SectionPanel title="Zone split" description="Operational branch balance between Capital / AMBA and Interior / GBA.">
          <div className="space-y-4">
            {snapshot.byZone.map((entry) => (
              <article key={entry.label}>
                <div className="flex items-center justify-between text-sm text-white/68">
                  <span>{entry.label}</span>
                  <span>{formatCount(entry.value)}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/6">
                  <div
                    className="h-2 rounded-full bg-[linear-gradient(90deg,#ffc15a_0%,#8de7dc_100%)]"
                    style={{ width: `${(entry.value / maxZone) * 100}%` }}
                  />
                </div>
              </article>
            ))}
          </div>
        </SectionPanel>
      </div>

      <div className="workspace-grid-2">
        <SectionPanel title="Top clients" description="Who generates the highest active load or recurrence.">
          <div className="space-y-4">
            {reports.byClient.map((entry) => (
              <article key={entry.label}>
                <div className="flex items-center justify-between text-sm text-white/68">
                  <span>{entry.label}</span>
                  <span>{formatCount(entry.value)}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/6">
                  <div
                    className="h-2 rounded-full bg-[linear-gradient(90deg,#8de7dc_0%,#5abab1_100%)]"
                    style={{ width: `${(entry.value / maxClient) * 100}%` }}
                  />
                </div>
              </article>
            ))}
          </div>
        </SectionPanel>

        <SectionPanel title="Top SKUs by quantity" description="Useful to spot product concentration and recurrent failure lines.">
          <div className="space-y-4">
            {reports.bySku.map((entry) => (
              <article key={entry.label}>
                <div className="flex items-center justify-between text-sm text-white/68">
                  <span>{entry.label}</span>
                  <span>{formatCount(entry.value)}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/6">
                  <div
                    className="h-2 rounded-full bg-[linear-gradient(90deg,#7bd691_0%,#8de7dc_100%)]"
                    style={{ width: `${(entry.value / maxSku) * 100}%` }}
                  />
                </div>
              </article>
            ))}
          </div>
        </SectionPanel>
      </div>

      <SectionPanel title="Planned exports" description="Static cards for the exports and management packs we can wire to API routes next without changing the UI contract.">
        <div className="workspace-grid-3">
          {[
            {
              title: "Open cases CSV",
              description: "Current queue with owner, status, substatus, next action and SLA."
            },
            {
              title: "Kingston dependency pack",
              description: "Cases in Pedido a Kingston, ETA notes and procurement blockers."
            },
            {
              title: "Pickup and dispatch list",
              description: "Daily logistics pack with ready-for-pickup and sent cases."
            }
          ].map((pack) => (
            <article key={pack.title} className="rounded-[1.25rem] border border-white/10 bg-white/4 px-4 py-5">
              <div className="text-lg font-semibold text-white">{pack.title}</div>
              <p className="mt-3 text-sm leading-7 text-white/62">{pack.description}</p>
              <button className="workspace-button-secondary mt-5" type="button">
                Queue export
              </button>
            </article>
          ))}
        </div>
      </SectionPanel>
    </div>
  );
}
