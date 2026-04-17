import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="workspace-panel max-w-[34rem] text-center">
        <p className="workspace-kicker">No encontrado</p>
        <h1 className="mt-3 text-4xl font-[var(--font-display)] tracking-[-0.06em] text-white">
          Esta pantalla no existe.
        </h1>
        <p className="mx-auto mt-4 max-w-[28rem] text-sm leading-7 text-white/62">
          El caso o la ruta que intentaste abrir no esta disponible en la muestra actual.
        </p>
        <div className="mt-8 flex justify-center">
          <Link className="workspace-button" href="/dashboard">
            Volver al resumen
          </Link>
        </div>
      </section>
    </main>
  );
}
