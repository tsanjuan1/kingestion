import Link from "next/link";

import { MetricCard } from "@/components/workspace/metric-card";
import { SectionPanel } from "@/components/workspace/section-panel";
import { ownerDirectory, transitionRules, workflowStates } from "@/lib/kingston/data";
import { formatCount } from "@/lib/kingston/helpers";

export default function WorkflowAdminPage() {
  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="workspace-page-header-row">
          <div>
            <p className="workspace-kicker">Admin / Workflow</p>
            <h1 className="workspace-title">Workflow governance</h1>
          </div>

          <div className="workspace-chip-row">
            <Link className="workspace-button-secondary" href="/dashboard">
              Dashboard
            </Link>
            <button className="workspace-button" type="button">
              Publish workflow version
            </button>
          </div>
        </div>
        <p className="workspace-subtitle">
          The workflow layer is the heart of the app: visible status, internal substatus, current owner and valid transitions living under explicit operating rules.
        </p>
      </header>

      <section className="workspace-grid-4">
        <MetricCard label="External states" value={formatCount(workflowStates.length)} hint="Operational states visible to the desk and management." />
        <MetricCard
          label="Substatuses"
          value={formatCount(workflowStates.reduce((sum, state) => sum + state.substatuses.length, 0))}
          hint="Internal operational granularity behind each visible state."
        />
        <MetricCard label="Transition rules" value={formatCount(transitionRules.length)} hint="Guardrails defining required fields and auto-actions." />
        <MetricCard label="Owning teams" value={formatCount(ownerDirectory.length)} hint="Initial staffing reference for responsibility and escalations." />
      </section>

      <SectionPanel title="Workflow map" description="Status architecture with category, intent and internal substeps.">
        <div className="workspace-grid-2">
          {workflowStates.map((state) => (
            <article key={state.status} className="rounded-[1.3rem] border border-white/10 bg-white/4 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xl font-[var(--font-display)] tracking-[-0.04em] text-white">{state.status}</div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.68rem] uppercase tracking-[0.16em] text-white/54">
                  {state.category}
                </span>
              </div>
              <p className="mt-3 text-sm leading-7 text-white/64">{state.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {state.substatuses.map((substatus) => (
                  <span key={substatus} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.13em] text-white/58">
                    {substatus}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </SectionPanel>

      <div className="workspace-grid-2">
        <SectionPanel title="Transition rules" description="What must exist before a case is allowed to move and what the system should generate automatically.">
          <div className="space-y-4">
            {transitionRules.map((rule) => (
              <article key={`${rule.from}-${rule.to}`} className="rounded-[1.3rem] border border-white/10 bg-white/4 px-4 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="workspace-chip">{rule.from}</span>
                  <span className="text-sm text-white/54">to</span>
                  <span className="workspace-chip workspace-chip-active">{rule.to}</span>
                </div>
                <p className="mt-4 text-sm leading-7 text-white/68">{rule.note}</p>
                <div className="mt-4 text-xs uppercase tracking-[0.16em] text-white/40">Required fields</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {rule.requiredFields.map((field) => (
                    <span key={field} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.13em] text-white/58">
                      {field}
                    </span>
                  ))}
                </div>
                <div className="mt-4 text-xs uppercase tracking-[0.16em] text-white/40">Auto tasks and notifications</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {rule.autoTasks.map((task) => (
                    <span key={task} className="rounded-full border border-[rgba(123,214,145,0.2)] bg-[rgba(123,214,145,0.12)] px-3 py-2 text-xs uppercase tracking-[0.13em] text-[#d6ffe0]">
                      {task}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </SectionPanel>

        <SectionPanel title="Core guardrails" description="The business rules that must stay true even when the UI or integrations evolve.">
          <div className="space-y-3">
            {[
              "Do not move to Aviso de envio without a defined zone.",
              "Do not move to Producto recepcionado y en preparacion without reception evidence.",
              "Do not move to Pedido a Kingston unless local and wholesaler stock are both unavailable.",
              "Do not move to Producto enviado without guide, transporter and dispatch date.",
              "Do not move to Realizado without confirmed delivery or pickup.",
              "Every status change must generate an audit event and keep a current owner."
            ].map((rule) => (
              <article key={rule} className="rounded-[1.2rem] border border-white/10 bg-white/4 px-4 py-4 text-sm leading-7 text-white/70">
                {rule}
              </article>
            ))}
          </div>
        </SectionPanel>
      </div>

      <SectionPanel title="Initial ownership directory" description="Seeded directory that the UI already uses for assignees, initials and team grouping.">
        <div className="workspace-grid-3">
          {ownerDirectory.map((owner) => (
            <article key={owner.name} className="rounded-[1.25rem] border border-white/10 bg-white/4 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.16em] text-white/40">{owner.team}</div>
              <div className="mt-3 text-xl font-[var(--font-display)] tracking-[-0.04em] text-white">{owner.name}</div>
              <div className="mt-2 text-sm text-white/58">{owner.initials} operational identifier</div>
            </article>
          ))}
        </div>
      </SectionPanel>
    </div>
  );
}
