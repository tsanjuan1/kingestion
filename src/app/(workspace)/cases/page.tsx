import Link from "next/link";

import { CaseTable } from "@/components/workspace/case-table";
import { SectionPanel } from "@/components/workspace/section-panel";
import { ownerDirectory, workflowStates } from "@/lib/kingston/data";
import { getCasesIndex, getSearchParamValue } from "@/lib/kingston/helpers";

type CasesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function buildFilterHref(base: Record<string, string | undefined>, key: string, value?: string) {
  const params = new URLSearchParams();

  Object.entries({ ...base, [key]: value }).forEach(([entryKey, entryValue]) => {
    if (entryValue) {
      params.set(entryKey, entryValue);
    }
  });

  const query = params.toString();
  return query ? `/cases?${query}` : "/cases";
}

export default async function CasesPage({ searchParams }: CasesPageProps) {
  const resolved = await searchParams;
  const filters = {
    q: getSearchParamValue(resolved.q),
    status: getSearchParamValue(resolved.status),
    zone: getSearchParamValue(resolved.zone),
    owner: getSearchParamValue(resolved.owner),
    delivery: getSearchParamValue(resolved.delivery)
  };

  const cases = getCasesIndex(filters);
  const baseFilters = {
    q: filters.q,
    status: filters.status,
    zone: filters.zone,
    owner: filters.owner,
    delivery: filters.delivery
  };

  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="workspace-page-header-row">
          <div>
            <p className="workspace-kicker">Cases</p>
            <h1 className="workspace-title">Case desk</h1>
          </div>

          <div className="workspace-chip-row">
            <Link className="workspace-button" href="/cases/new">
              New case
            </Link>
            <Link className="workspace-button-secondary" href="/reports">
              Export planning
            </Link>
          </div>
        </div>
        <p className="workspace-subtitle">
          Central queue with enough context to decide, reassign, move status or open the full case record without losing the operational story.
        </p>
      </header>

      <SectionPanel title="Filters" description="Static filters over the seeded dataset. Later these same inputs can drive backend search without reworking the layout.">
        <div className="space-y-5">
          <div className="workspace-chip-row">
            <Link className={`workspace-chip ${!filters.status ? "workspace-chip-active" : ""}`} href={buildFilterHref(baseFilters, "status")}>
              All statuses
            </Link>
            {workflowStates.map((state) => (
              <Link
                key={state.status}
                className={`workspace-chip ${filters.status === state.status ? "workspace-chip-active" : ""}`}
                href={buildFilterHref(baseFilters, "status", state.status)}
              >
                {state.status}
              </Link>
            ))}
          </div>

          <div className="workspace-chip-row">
            <Link className={`workspace-chip ${!filters.zone ? "workspace-chip-active" : ""}`} href={buildFilterHref(baseFilters, "zone")}>
              All zones
            </Link>
            {["Interior / Gran Buenos Aires", "Capital / AMBA"].map((zone) => (
              <Link
                key={zone}
                className={`workspace-chip ${filters.zone === zone ? "workspace-chip-active" : ""}`}
                href={buildFilterHref(baseFilters, "zone", zone)}
              >
                {zone}
              </Link>
            ))}
          </div>

          <div className="workspace-chip-row">
            <Link className={`workspace-chip ${!filters.owner ? "workspace-chip-active" : ""}`} href={buildFilterHref(baseFilters, "owner")}>
              All owners
            </Link>
            {ownerDirectory.map((owner) => (
              <Link
                key={owner.name}
                className={`workspace-chip ${filters.owner === owner.name ? "workspace-chip-active" : ""}`}
                href={buildFilterHref(baseFilters, "owner", owner.name)}
              >
                {owner.name}
              </Link>
            ))}
          </div>

          <div className="workspace-chip-row">
            <Link
              className={`workspace-chip ${!filters.delivery ? "workspace-chip-active" : ""}`}
              href={buildFilterHref(baseFilters, "delivery")}
            >
              All delivery modes
            </Link>
            {["Dispatch", "Pickup"].map((delivery) => (
              <Link
                key={delivery}
                className={`workspace-chip ${filters.delivery === delivery ? "workspace-chip-active" : ""}`}
                href={buildFilterHref(baseFilters, "delivery", delivery)}
              >
                {delivery}
              </Link>
            ))}
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        title={`Queue result (${cases.length})`}
        description="The current implementation already behaves as a real desk: filtered queue, direct access to details and full operational context."
      >
        <CaseTable cases={cases} />
      </SectionPanel>
    </div>
  );
}
