import Link from "next/link";

import { MetricCard } from "@/components/workspace/metric-card";
import { ModuleSubnav } from "@/components/workspace/module-subnav";
import { SectionPanel } from "@/components/workspace/section-panel";
import { ownerDirectory, transitionRules, workflowStates } from "@/lib/kingston/data";
import { formatCount, getTeamLabel, getWorkflowCategoryLabel } from "@/lib/kingston/helpers";

type WorkflowAdminPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WorkflowAdminPage({ searchParams }: WorkflowAdminPageProps) {
  const resolved = await searchParams;
  const view = Array.isArray(resolved.view) ? resolved.view[0] : resolved.view ?? "estados";

  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="workspace-page-header-row">
          <div>
            <p className="workspace-kicker">Configuracion</p>
            <h1 className="workspace-title">Flujo operativo</h1>
          </div>

          <div className="workspace-chip-row">
            <Link className="workspace-button-secondary" href="/dashboard">
              Volver al inicio
            </Link>
            <Link className="workspace-button" href="/cases">
              Ver casos
            </Link>
          </div>
        </div>
        <p className="workspace-subtitle">
          El modulo de configuracion queda separado por submodulos para revisar estados, transiciones, reglas y equipos sin mezclar toda la informacion.
        </p>
      </header>

      <ModuleSubnav
        items={[
          { href: "/admin/workflow?view=estados", label: "Estados", active: view === "estados" },
          { href: "/admin/workflow?view=transiciones", label: "Transiciones", active: view === "transiciones" },
          { href: "/admin/workflow?view=reglas", label: "Reglas", active: view === "reglas" },
          { href: "/admin/workflow?view=equipos", label: "Equipos", active: view === "equipos" }
        ]}
      />

      <section className="workspace-grid-4">
        <MetricCard label="Estados externos" value={formatCount(workflowStates.length)} hint="Estados visibles para la operacion." />
        <MetricCard
          label="Subestados"
          value={formatCount(workflowStates.reduce((sum, state) => sum + state.substatuses.length, 0))}
          hint="Detalle operativo interno por estado."
        />
        <MetricCard label="Transiciones" value={formatCount(transitionRules.length)} hint="Reglas que controlan el pasaje entre estados." />
        <MetricCard label="Equipos" value={formatCount(ownerDirectory.length)} hint="Referencias iniciales para responsables." />
      </section>

      {view === "estados" ? (
        <SectionPanel title="Mapa de estados" description="Estados externos y subestados asociados.">
          <div className="workspace-grid-2">
            {workflowStates.map((state) => (
              <article key={state.status} className="rounded-[1rem] border border-white/10 bg-white/4 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-lg font-semibold text-white">{state.status}</div>
                  <span className="workspace-chip">{getWorkflowCategoryLabel(state.category)}</span>
                </div>
                <p className="mt-2 text-sm leading-7 text-white/64">{state.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {state.substatuses.map((substatus) => (
                    <span key={substatus} className="workspace-chip">
                      {substatus}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </SectionPanel>
      ) : null}

      {view === "transiciones" ? (
        <SectionPanel title="Transiciones" description="Definen que hace falta para mover un caso y que acciones automaticas se disparan.">
          <div className="space-y-4">
            {transitionRules.map((rule) => (
              <article key={`${rule.from}-${rule.to}`} className="rounded-[1rem] border border-white/10 bg-white/4 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="workspace-chip">{rule.from}</span>
                  <span className="text-sm text-white/58">a</span>
                  <span className="workspace-chip workspace-chip-active">{rule.to}</span>
                </div>
                <p className="mt-3 text-sm leading-7 text-white/66">{rule.note}</p>
                <div className="mt-3 text-xs uppercase tracking-[0.16em] text-white/40">Campos requeridos</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {rule.requiredFields.map((field) => (
                    <span key={field} className="workspace-chip">
                      {field}
                    </span>
                  ))}
                </div>
                <div className="mt-3 text-xs uppercase tracking-[0.16em] text-white/40">Acciones automaticas</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {rule.autoTasks.map((task) => (
                    <span key={task} className="workspace-chip workspace-chip-active">
                      {task}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </SectionPanel>
      ) : null}

      {view === "reglas" ? (
        <SectionPanel title="Reglas obligatorias" description="Reglas de negocio que no deberian romperse aunque cambie la UI o la integracion.">
          <div className="space-y-3">
            {[
              "No pasar a Aviso de envio sin zona definida.",
              "No pasar a Producto recepcionado y en preparacion sin evidencia de recepcion.",
              "No pasar a Pedido a Kingston sin registrar falta de stock local y mayorista.",
              "No pasar a Producto enviado sin guia, transportista y fecha de despacho.",
              "No pasar a Realizado sin confirmar entrega o retiro.",
              "Cada cambio de estado debe dejar evento de auditoria y responsable actual."
            ].map((rule) => (
              <article key={rule} className="rounded-[1rem] border border-white/10 bg-white/4 px-4 py-4 text-sm leading-7 text-white/68">
                {rule}
              </article>
            ))}
          </div>
        </SectionPanel>
      ) : null}

      {view === "equipos" ? (
        <SectionPanel title="Equipos y responsables" description="Directorio inicial usado en la aplicacion para asignaciones y agrupacion.">
          <div className="workspace-grid-3">
            {ownerDirectory.map((owner) => (
              <article key={owner.name} className="rounded-[1rem] border border-white/10 bg-white/4 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-white/40">{getTeamLabel(owner.team)}</div>
                <div className="mt-2 text-lg font-semibold text-white">{owner.name}</div>
                <div className="mt-1 text-sm text-white/58">Identificador {owner.initials}</div>
              </article>
            ))}
          </div>
        </SectionPanel>
      ) : null}
    </div>
  );
}
