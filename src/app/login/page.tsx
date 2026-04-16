import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(90,186,173,0.2),transparent_24%),linear-gradient(180deg,#0b1513_0%,#081311_48%,#091210_100%)] px-4 py-8 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl gap-6 rounded-[2rem] border border-white/10 bg-[rgba(7,15,13,0.72)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur md:grid-cols-[1.15fr_0.85fr] md:p-6">
        <section className="flex flex-col justify-between rounded-[1.6rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-white/44">Kingestion</p>
            <h1 className="mt-5 max-w-[14ch] font-[var(--font-display)] text-5xl leading-none tracking-[-0.08em] text-white">
              Kingston case operations in one desk
            </h1>
            <p className="mt-6 max-w-[36rem] text-base leading-8 text-white/66">
              A dedicated internal app for intake, workflow, SLA, logistics and traceability. Separate from Anyx Comercial, but operated with the same publish-as-we-build rhythm.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["Cases", "Full queue, detail and audit timeline."],
              ["Tasks", "Ownership, due dates and bottlenecks."],
              ["Reports", "Aging, throughput and Kingston dependency."]
            ].map(([title, description]) => (
              <article key={title} className="rounded-[1.2rem] border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-lg font-semibold text-white">{title}</div>
                <p className="mt-2 text-sm leading-7 text-white/60">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[1.6rem] border border-white/8 bg-[rgba(9,18,16,0.88)] p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-white/44">Internal access</div>
          <h2 className="mt-4 font-[var(--font-display)] text-3xl tracking-[-0.06em] text-white">Sign in</h2>
          <p className="mt-3 text-sm leading-7 text-white/62">
            The visual layer is ready for auth wiring. For now, use the workspace entry button to review the operating prototype.
          </p>

          <div className="mt-8 space-y-5">
            <label className="workspace-label">
              <span>Work email</span>
              <input className="workspace-input" defaultValue="operaciones@anyx.com.ar" />
            </label>
            <label className="workspace-label">
              <span>Password</span>
              <input className="workspace-input" defaultValue="********" type="password" />
            </label>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="workspace-button" href="/dashboard">
              Enter workspace
            </Link>
            <Link className="workspace-button-secondary" href="/cases">
              Open case desk
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
