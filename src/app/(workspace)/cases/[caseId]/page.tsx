import Link from "next/link";
import { notFound } from "next/navigation";

import { EventTimeline } from "@/components/workspace/event-timeline";
import { SectionPanel } from "@/components/workspace/section-panel";
import { StatusPill } from "@/components/workspace/status-pill";
import { TaskList } from "@/components/workspace/task-list";
import { transitionRules } from "@/lib/kingston/data";
import {
  formatDate,
  formatDateTime,
  getCaseAgingDays,
  getCaseById,
  getOwnerInitials,
  getOwnerTeam,
  getSlaLabel
} from "@/lib/kingston/helpers";

type CaseDetailPageProps = {
  params: Promise<{ caseId: string }>;
};

export default async function CaseDetailPage({ params }: CaseDetailPageProps) {
  const { caseId } = await params;
  const entry = getCaseById(caseId);

  if (!entry) {
    notFound();
  }

  const nextTransitions = transitionRules.filter((rule) => rule.from === entry.externalStatus);
  const taskItems = entry.tasks.map((task) => ({
    ...task,
    caseId: entry.id,
    caseNumber: entry.internalNumber,
    clientName: entry.clientName
  }));

  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="workspace-page-header-row">
          <div>
            <p className="workspace-kicker">Cases / Detail</p>
            <h1 className="workspace-title">{entry.internalNumber}</h1>
          </div>

          <div className="workspace-chip-row">
            <Link className="workspace-button-secondary" href="/cases">
              Back to desk
            </Link>
            <Link className="workspace-button" href="/cases/new">
              Create follow-up case
            </Link>
          </div>
        </div>

        <div className="workspace-chip-row">
          <StatusPill kind="status" value={entry.externalStatus} />
          <StatusPill kind="sla" value={entry.slaDueAt} label={getSlaLabel(entry.slaDueAt)} />
          <span className="workspace-chip workspace-chip-active">{entry.priority} priority</span>
          <span className="workspace-chip">{entry.zone}</span>
          <span className="workspace-chip">{entry.deliveryMode}</span>
        </div>

        <p className="workspace-subtitle">
          {entry.clientName} / {entry.productDescription}. Current owner is {entry.owner} from {getOwnerTeam(entry.owner)} and the active substatus is{" "}
          {entry.internalSubstatus}.
        </p>
      </header>

      <section className="workspace-grid-4">
        <article className="workspace-panel space-y-3">
          <p className="workspace-kicker">Current owner</p>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/6 text-sm font-semibold text-white">
              {getOwnerInitials(entry.owner)}
            </div>
            <div>
              <div className="text-lg font-semibold text-white">{entry.owner}</div>
              <div className="text-sm text-white/56">{getOwnerTeam(entry.owner)}</div>
            </div>
          </div>
        </article>

        <article className="workspace-panel space-y-3">
          <p className="workspace-kicker">Next action</p>
          <div className="text-lg font-semibold text-white">{entry.nextAction}</div>
          <div className="text-sm text-white/56">Updated {formatDateTime(entry.updatedAt)}</div>
        </article>

        <article className="workspace-panel space-y-3">
          <p className="workspace-kicker">Aging</p>
          <div className="text-4xl font-[var(--font-display)] tracking-[-0.06em] text-white">{getCaseAgingDays(entry)}d</div>
          <div className="text-sm text-white/56">Opened {formatDate(entry.openedAt)}</div>
        </article>

        <article className="workspace-panel space-y-3">
          <p className="workspace-kicker">Kingston ref</p>
          <div className="text-lg font-semibold text-white">{entry.kingstonNumber}</div>
          <div className="text-sm text-white/56">Origin {entry.origin}</div>
        </article>
      </section>

      <div className="workspace-grid-2">
        <SectionPanel title="Customer" description="Who owns the issue on the customer side and how the delivery branch should behave.">
          <dl className="workspace-data-list">
            <div className="workspace-data-item">
              <dt>Client</dt>
              <dd>{entry.clientName}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>Contact</dt>
              <dd>{entry.contactName}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>Email</dt>
              <dd>{entry.contactEmail}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>Phone</dt>
              <dd>{entry.contactPhone}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>Address</dt>
              <dd>
                {entry.address}, {entry.city}, {entry.province}
              </dd>
            </div>
            <div className="workspace-data-item">
              <dt>Zone and delivery</dt>
              <dd>
                {entry.zone} / {entry.deliveryMode}
              </dd>
            </div>
          </dl>
        </SectionPanel>

        <SectionPanel title="Product" description="Fault, quantity and evidence context for technical and procurement decisions.">
          <dl className="workspace-data-list">
            <div className="workspace-data-item">
              <dt>SKU</dt>
              <dd>{entry.sku}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>Description</dt>
              <dd>{entry.productDescription}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>Quantity</dt>
              <dd>{entry.quantity}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>Failure description</dt>
              <dd>{entry.failureDescription}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>Operational observations</dt>
              <dd>{entry.observations}</dd>
            </div>
          </dl>
        </SectionPanel>
      </div>

      <div className="workspace-grid-2">
        <SectionPanel title="Logistics" description="Dispatch or pickup data needed to complete the last mile without email chasing.">
          <dl className="workspace-data-list">
            <div className="workspace-data-item">
              <dt>Mode</dt>
              <dd>{entry.logistics.mode}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>Delivery address</dt>
              <dd>{entry.logistics.address}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>Transporter</dt>
              <dd>{entry.logistics.transporter ?? "Pending definition"}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>Guide</dt>
              <dd>{entry.logistics.guideNumber ?? "Not assigned yet"}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>Dispatch / delivery</dt>
              <dd>
                {(entry.logistics.dispatchDate && formatDateTime(entry.logistics.dispatchDate)) ?? "Dispatch pending"} /{" "}
                {(entry.logistics.deliveredDate && formatDateTime(entry.logistics.deliveredDate)) ?? "Delivery pending"}
              </dd>
            </div>
            <div className="workspace-data-item">
              <dt>Tracking</dt>
              <dd>
                {entry.logistics.trackingUrl ? (
                  <a className="text-[#8de7dc]" href={entry.logistics.trackingUrl} target="_blank" rel="noreferrer">
                    Open tracking
                  </a>
                ) : (
                  "No tracking loaded"
                )}
              </dd>
            </div>
          </dl>
        </SectionPanel>

        <SectionPanel title="Procurement and Kingston" description="Stock path, supplier dependency and warehouse readiness in a single view.">
          <dl className="workspace-data-list">
            <div className="workspace-data-item">
              <dt>Local stock</dt>
              <dd>{entry.procurement.localStock}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>Wholesaler stock</dt>
              <dd>
                {entry.procurement.wholesalerStock}
                {entry.procurement.wholesalerName ? ` / ${entry.procurement.wholesalerName}` : ""}
              </dd>
            </div>
            <div className="workspace-data-item">
              <dt>Requires Kingston order</dt>
              <dd>{entry.procurement.requiresKingstonOrder ? "Yes" : "No"}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>Requested to Kingston</dt>
              <dd>{entry.procurement.kingstonRequestedAt ? formatDateTime(entry.procurement.kingstonRequestedAt) : "Not requested yet"}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>Received from USA</dt>
              <dd>{entry.procurement.receivedFromUsaAt ? formatDateTime(entry.procurement.receivedFromUsaAt) : "Awaiting arrival"}</dd>
            </div>
            <div className="workspace-data-item">
              <dt>Warehouse movement</dt>
              <dd>{entry.procurement.movedToRmaWarehouse ? "Moved to RMA warehouse" : "Pending warehouse move"}</dd>
            </div>
          </dl>
        </SectionPanel>
      </div>

      <div className="workspace-grid-2">
        <SectionPanel title="Active tasks" description="The work queue attached to this case, with owner and due date.">
          <TaskList tasks={taskItems} emptyLabel="There are no active tasks attached to this case." />
        </SectionPanel>

        <SectionPanel title="Next valid transitions" description="Operational guardrails already expressed as transition rules for this case.">
          <div className="space-y-4">
            {nextTransitions.length > 0 ? (
              nextTransitions.map((rule) => (
                <article key={`${rule.from}-${rule.to}`} className="rounded-[1.25rem] border border-white/10 bg-white/4 px-4 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="workspace-chip workspace-chip-active">{rule.from}</span>
                    <span className="text-sm text-white/56">to</span>
                    <span className="workspace-chip">{rule.to}</span>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-white/68">{rule.note}</p>
                  <div className="mt-4 text-xs uppercase tracking-[0.16em] text-white/40">Required fields</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {rule.requiredFields.map((field) => (
                      <span key={field} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.14em] text-white/58">
                        {field}
                      </span>
                    ))}
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[1.35rem] border border-dashed border-white/12 bg-white/3 px-5 py-6 text-sm text-white/50">
                This case is already at a terminal state or does not have an additional rule seeded yet.
              </div>
            )}
          </div>
        </SectionPanel>
      </div>

      <div className="workspace-grid-2">
        <SectionPanel title="Attachments" description="Documents, guides, forms or proof already loaded into the case trail.">
          <div className="space-y-3">
            {entry.attachments.map((attachment) => (
              <article key={attachment.id} className="rounded-[1.2rem] border border-white/10 bg-white/4 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{attachment.name}</div>
                    <div className="mt-1 text-sm text-white/56">
                      {attachment.kind} / {attachment.sizeLabel}
                    </div>
                  </div>
                  <div className="text-xs uppercase tracking-[0.16em] text-white/40">
                    {attachment.uploadedBy} / {formatDateTime(attachment.createdAt)}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </SectionPanel>

        <SectionPanel title="Comments" description="Internal notes that travel with the case and keep the reasoning visible.">
          <div className="space-y-3">
            {entry.comments.map((comment) => (
              <article key={comment.id} className="rounded-[1.2rem] border border-white/10 bg-white/4 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white">{comment.author}</div>
                  <div className="text-xs uppercase tracking-[0.16em] text-white/40">
                    {comment.internal ? "Internal" : "External"} / {formatDateTime(comment.createdAt)}
                  </div>
                </div>
                <p className="mt-3 text-sm leading-7 text-white/70">{comment.body}</p>
              </article>
            ))}
          </div>
        </SectionPanel>
      </div>

      <SectionPanel title="Workflow history" description="Immutable trail of state, logistics and communication events for the full case story.">
        <EventTimeline events={entry.events} />
      </SectionPanel>
    </div>
  );
}
