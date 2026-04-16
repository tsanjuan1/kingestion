import Link from "next/link";

import { SectionPanel } from "@/components/workspace/section-panel";
import { ownerDirectory, workflowStates } from "@/lib/kingston/data";

export default function NewCasePage() {
  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="workspace-page-header-row">
          <div>
            <p className="workspace-kicker">Cases / Intake</p>
            <h1 className="workspace-title">Create new Kingston case</h1>
          </div>

          <div className="workspace-chip-row">
            <Link className="workspace-button-secondary" href="/cases">
              Back to desk
            </Link>
            <button className="workspace-button" type="button">
              Create operational case
            </button>
          </div>
        </div>
        <p className="workspace-subtitle">
          Intake is already structured like a real RMA handoff: Kingston reference, customer context, product failure,
          route decision and the first owner in one controlled screen.
        </p>
      </header>

      <div className="workspace-grid-2">
        <SectionPanel
          title="Case intake"
          description="Core references, ownership and the first workflow state. This is the base record that later feeds tasks, SLA and audit trail."
        >
          <form className="space-y-6">
            <div className="workspace-form-grid">
              <label className="workspace-label">
                <span>Kingston case</span>
                <input className="workspace-input" defaultValue="KS-" placeholder="KS-984311" />
              </label>
              <label className="workspace-label">
                <span>Internal case</span>
                <input className="workspace-input" defaultValue="Auto-generated on save" readOnly />
              </label>
              <label className="workspace-label">
                <span>Client</span>
                <input className="workspace-input" placeholder="Micro Delta SA" />
              </label>
              <label className="workspace-label">
                <span>Origin</span>
                <select className="workspace-select" defaultValue="Kingston email">
                  <option>Kingston email</option>
                  <option>Operations load</option>
                  <option>Commercial handoff</option>
                </select>
              </label>
              <label className="workspace-label">
                <span>Owner</span>
                <select className="workspace-select" defaultValue="Lucia Costa">
                  {ownerDirectory.map((owner) => (
                    <option key={owner.name}>{owner.name}</option>
                  ))}
                </select>
              </label>
              <label className="workspace-label">
                <span>Initial status</span>
                <select className="workspace-select" defaultValue="Informado">
                  {workflowStates.map((state) => (
                    <option key={state.status}>{state.status}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="workspace-label">
              <span>Next action</span>
              <input
                className="workspace-input"
                defaultValue="Validate zone, confirm intake and send first customer communication."
              />
            </label>

            <label className="workspace-label">
              <span>Operational observations</span>
              <textarea
                className="workspace-textarea"
                defaultValue="This field is ready for contract notes, priority context, exceptions or anything that should travel with the case from day one."
              />
            </label>
          </form>
        </SectionPanel>

        <SectionPanel
          title="What happens on save"
          description="These are the automations and controls this form is already designed to trigger once backend wiring lands."
        >
          <div className="space-y-4">
            {[
              "Create audit event for case creation.",
              "Open the first task for intake validation.",
              "Assign current owner and team.",
              "Start SLA clock according to the selected route.",
              "Prepare first customer communication template."
            ].map((item) => (
              <article key={item} className="rounded-[1.2rem] border border-white/10 bg-white/4 px-4 py-4 text-sm leading-7 text-white/70">
                {item}
              </article>
            ))}
          </div>
        </SectionPanel>
      </div>

      <div className="workspace-grid-2">
        <SectionPanel title="Customer and delivery" description="Contactability, location and route conditions for dispatch or pickup.">
          <div className="workspace-form-grid">
            <label className="workspace-label">
              <span>Contact name</span>
              <input className="workspace-input" placeholder="Nadia Ferreyra" />
            </label>
            <label className="workspace-label">
              <span>Email</span>
              <input className="workspace-input" placeholder="nadia.ferreyra@cliente.com" />
            </label>
            <label className="workspace-label">
              <span>Phone</span>
              <input className="workspace-input" placeholder="+54 11 4968 2240" />
            </label>
            <label className="workspace-label">
              <span>Zone</span>
              <select className="workspace-select" defaultValue="Interior / Gran Buenos Aires">
                <option>Interior / Gran Buenos Aires</option>
                <option>Capital / AMBA</option>
              </select>
            </label>
            <label className="workspace-label">
              <span>Province</span>
              <input className="workspace-input" placeholder="Cordoba" />
            </label>
            <label className="workspace-label">
              <span>City</span>
              <input className="workspace-input" placeholder="Cordoba" />
            </label>
          </div>

          <label className="workspace-label mt-6">
            <span>Address</span>
            <input className="workspace-input" placeholder="Av. Colon 4132" />
          </label>

          <div className="workspace-form-grid mt-6">
            <label className="workspace-label">
              <span>Delivery mode</span>
              <select className="workspace-select" defaultValue="Dispatch">
                <option>Dispatch</option>
                <option>Pickup</option>
              </select>
            </label>
            <label className="workspace-label">
              <span>Priority</span>
              <select className="workspace-select" defaultValue="High">
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Critical</option>
              </select>
            </label>
          </div>
        </SectionPanel>

        <SectionPanel title="Product and fault" description="Enough detail to decide stock, supplier route and technical validation without chasing the original mail again.">
          <div className="workspace-form-grid">
            <label className="workspace-label">
              <span>SKU</span>
              <input className="workspace-input" placeholder="KF432C16BB/16" />
            </label>
            <label className="workspace-label">
              <span>Quantity</span>
              <input className="workspace-input" defaultValue="1" />
            </label>
          </div>

          <label className="workspace-label mt-6">
            <span>Product description</span>
            <input className="workspace-input" placeholder="Memoria DDR4 16GB Fury Beast" />
          </label>

          <label className="workspace-label mt-6">
            <span>Failure description</span>
            <textarea
              className="workspace-textarea"
              defaultValue="Capture the customer-reported issue, environment, repetition pattern and any signal that helps technical validation."
            />
          </label>

          <label className="workspace-label mt-6">
            <span>Initial evidence</span>
            <textarea
              className="workspace-textarea"
              defaultValue="Photo links, mail references, serial batch or anything that should land in attachments on create."
            />
          </label>
        </SectionPanel>
      </div>
    </div>
  );
}
