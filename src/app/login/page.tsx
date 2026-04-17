import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#0b1220_0%,#0f172a_100%)] px-4 py-8 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl gap-6 rounded-[1.6rem] border border-white/10 bg-[rgba(11,18,32,0.84)] p-5 shadow-[0_24px_80px_rgba(2,6,23,0.35)] md:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[1.2rem] border border-white/8 bg-white/4 p-6">
          <p className="workspace-kicker">Kingestion</p>
          <h1 className="mt-4 font-[var(--font-display)] text-5xl leading-none tracking-[-0.08em] text-white">
            Gestion de casos Kingston
          </h1>
          <p className="mt-5 max-w-[34rem] text-base leading-8 text-white/66">
            Plataforma interna para ANYX. Casos, tareas, flujo, historial y reportes en una interfaz mas simple y orientada a modulos.
          </p>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {[
              ["Casos", "Bandeja, filtros y detalle."],
              ["Tareas", "Vencimientos y responsables."],
              ["Reportes", "Visibilidad operativa y gerencial."]
            ].map(([title, description]) => (
              <article key={title} className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-lg font-semibold text-white">{title}</div>
                <p className="mt-2 text-sm leading-7 text-white/60">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[1.2rem] border border-white/8 bg-[rgba(23,35,56,0.92)] p-6">
          <div className="workspace-kicker">Acceso</div>
          <h2 className="mt-3 text-3xl font-[var(--font-display)] tracking-[-0.06em] text-white">Ingresar</h2>
          <p className="mt-3 text-sm leading-7 text-white/62">
            La capa visual ya esta lista para conectar autenticacion. Mientras tanto, esta pantalla funciona como acceso directo al workspace.
          </p>

          <div className="mt-8 space-y-5">
            <label className="workspace-label">
              <span>Correo de trabajo</span>
              <input className="workspace-input" defaultValue="operaciones@anyx.com.ar" />
            </label>
            <label className="workspace-label">
              <span>Contrasena</span>
              <input className="workspace-input" defaultValue="********" type="password" />
            </label>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="workspace-button" href="/dashboard">
              Entrar al sistema
            </Link>
            <Link className="workspace-button-secondary" href="/cases">
              Ir a la bandeja
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
