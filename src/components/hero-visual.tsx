const lanes = [
  { label: "cuentas", value: "24 activas" },
  { label: "seguimiento", value: "8 hoy" },
  { label: "pendientes", value: "3 criticos" }
];

const modules = ["pipeline", "cobranza", "agenda", "alertas", "clientes", "contexto"];
const bars = [42, 72, 54, 86, 61, 92, 65, 47, 70, 84, 59, 77];

export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[580px]">
      <div className="drift-a absolute inset-x-[12%] top-[8%] h-[16rem] rounded-full bg-[radial-gradient(circle,rgba(214,125,79,0.34),transparent_62%)] blur-3xl" />
      <div className="drift-b absolute -right-8 top-8 h-44 w-44 rounded-full border border-[rgba(23,39,34,0.14)]" />
      <div className="drift-a absolute -left-6 bottom-14 h-36 w-36 rounded-full border border-[rgba(13,106,99,0.18)]" />

      <div className="panel-sheen relative aspect-[4/5] overflow-hidden rounded-[2.3rem] border border-[rgba(23,39,34,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.72)_0%,rgba(240,233,220,0.84)_100%)] p-6 shadow-[0_30px_80px_rgba(23,39,34,0.12)] md:p-8">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.24)_0%,transparent_24%,transparent_76%,rgba(13,106,99,0.08)_100%)]" />
        <div className="pulse-grid absolute inset-[1.15rem] rounded-[1.7rem] border border-[rgba(23,39,34,0.08)] bg-[linear-gradient(rgba(23,39,34,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(23,39,34,0.04)_1px,transparent_1px)] bg-[size:22px_22px]" />

        <div className="relative z-10 flex h-full flex-col">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                Vista operativa
              </p>
              <h2 className="mt-3 max-w-[9ch] font-[var(--font-display)] text-[2.5rem] leading-[0.92] tracking-[-0.06em] text-[var(--ink)]">
                Una sola lectura.
              </h2>
            </div>
            <span className="rounded-full border border-[rgba(13,106,99,0.18)] px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
              live
            </span>
          </div>

          <div className="mt-8 grid gap-3">
            {lanes.map((lane) => (
              <div
                key={lane.label}
                className="flex items-center justify-between rounded-[1.2rem] border border-[rgba(23,39,34,0.1)] bg-[rgba(255,255,255,0.58)] px-4 py-3"
              >
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                  {lane.label}
                </span>
                <span className="font-[var(--font-display)] text-[1.3rem] tracking-[-0.04em] text-[var(--ink)]">
                  {lane.value}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {modules.map((module) => (
              <div
                key={module}
                className="rounded-[1.1rem] border border-[rgba(23,39,34,0.1)] bg-[rgba(248,244,236,0.86)] px-3 py-3 text-center text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[var(--ink)]"
              >
                {module}
              </div>
            ))}
          </div>

          <div className="mt-auto rounded-[1.7rem] border border-[rgba(23,39,34,0.12)] bg-[rgba(23,39,34,0.9)] p-5 text-[#f3ebdf]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[rgba(243,235,223,0.62)]">
                  Ritmo del dia
                </p>
                <p className="mt-2 font-[var(--font-display)] text-[2rem] leading-none tracking-[-0.06em]">
                  foco y trazabilidad
                </p>
              </div>
              <span className="rounded-full bg-[rgba(214,125,79,0.18)] px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#f0b089]">
                continuo
              </span>
            </div>

            <div className="mt-5 grid h-28 grid-cols-12 items-end gap-2">
              {bars.map((value, index) => (
                <span
                  key={`${value}-${index}`}
                  className="rounded-full bg-[linear-gradient(180deg,#d9b79a_0%,#d67d4f_100%)]"
                  style={{ height: `${value}px` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
