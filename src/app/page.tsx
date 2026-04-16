import { ContactForm } from "@/components/contact-form";
import { HeroVisual } from "@/components/hero-visual";

const platformBands = [
  "pipeline visible",
  "ritmo comercial",
  "seguimiento operativo",
  "estado de cuentas",
  "alertas accionables",
  "tablero de gestion",
  "pipeline visible",
  "ritmo comercial",
  "seguimiento operativo",
  "estado de cuentas",
  "alertas accionables",
  "tablero de gestion"
];

const pillars = [
  {
    name: "Operacion alineada",
    description: "Ventas, pendientes, tareas y contexto en una sola lectura para evitar cambios de canal y dobles cargas."
  },
  {
    name: "Seguimiento con ritmo",
    description: "Cada oportunidad y cada cuenta avanza con proximos pasos claros, responsables y alertas reales."
  },
  {
    name: "Gestion que se entiende",
    description: "Indicadores, estados y conversaciones con lenguaje operativo, no con reportes frios que llegan tarde."
  }
];

const flow = [
  {
    step: "01",
    title: "Entradas limpias",
    text: "Centraliza pedidos, contactos y novedades para que el equipo arranque cada dia desde la misma verdad."
  },
  {
    step: "02",
    title: "Prioridades visibles",
    text: "Destaca vencimientos, cuentas sensibles y oportunidades activas sin depender de una planilla manual."
  },
  {
    step: "03",
    title: "Seguimiento vivo",
    text: "Cada avance deja traza y contexto para que nadie retome un cliente a ciegas."
  }
];

const scope = [
  "captura y seguimiento de consultas comerciales",
  "vista operativa de pipeline, tareas y proximos pasos",
  "orden de cuentas, estados y observaciones sensibles",
  "base preparada para seguir sumando automatizaciones"
];

export default function HomePage() {
  return (
    <main className="overflow-hidden">
      <section className="relative isolate min-h-screen overflow-hidden px-6 pb-16 pt-6 md:px-8 lg:px-10">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.85),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.28),transparent_22%),linear-gradient(180deg,transparent_0%,rgba(23,39,34,0.04)_100%)]" />
        <div className="absolute inset-x-0 top-[6rem] -z-10 h-[28rem] bg-[radial-gradient(circle,rgba(214,125,79,0.18),transparent_54%)] blur-3xl" />

        <header className="mx-auto flex max-w-[1440px] items-center justify-between gap-6 py-4">
          <a href="#" className="font-[var(--font-display)] text-[1.35rem] tracking-[0.08em] text-[var(--ink)]">
            KINGESTION
          </a>
          <nav className="hidden items-center gap-7 text-sm font-medium text-[var(--muted)] md:flex">
            <a href="#plataforma" className="transition-colors hover:text-[var(--ink)]">
              Plataforma
            </a>
            <a href="#flujo" className="transition-colors hover:text-[var(--ink)]">
              Flujo
            </a>
            <a href="#contacto" className="transition-colors hover:text-[var(--ink)]">
              Contacto
            </a>
          </nav>
        </header>

        <div className="mx-auto grid max-w-[1440px] gap-14 pb-8 pt-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.85fr)] lg:items-end lg:gap-10 lg:pb-16">
          <div className="max-w-[680px] lg:pb-6">
            <p className="section-tag hero-rise">Sistema de gestion con pulso comercial</p>
            <h1 className="hero-rise-delay mt-6 max-w-[11ch] font-[var(--font-display)] text-[clamp(4rem,11vw,8.7rem)] leading-[0.9] tracking-[-0.05em] text-[var(--ink)]">
              Kingestion
            </h1>
            <p className="hero-rise-delay-2 mt-6 max-w-[33rem] text-[1.1rem] leading-8 text-[var(--muted)] md:text-[1.2rem]">
              La capa operativa para dejar de perseguir informacion suelta y empezar a leer ventas, seguimiento y gestion desde un mismo frente.
            </p>

            <div className="hero-rise-delay-2 mt-10 flex flex-wrap gap-4">
              <a href="#contacto" className="cta-button">
                Pedir primera demo
              </a>
              <a href="#plataforma" className="ghost-button">
                Ver que ordena
              </a>
            </div>

            <div className="hero-rise-delay-2 mt-14 max-w-[38rem] border-t border-[var(--line)] pt-6 text-sm uppercase tracking-[0.24em] text-[var(--muted)]">
              Pensada para equipos que hoy reparten la operacion entre WhatsApp, planillas y memoria humana.
            </div>
          </div>

          <HeroVisual />
        </div>

        <div className="mx-auto mt-8 max-w-[1440px] overflow-hidden rounded-full border border-[var(--line)] bg-[rgba(255,255,255,0.38)] px-4 py-3 backdrop-blur">
          <div className="marquee-track">
            {platformBands.map((item, index) => (
              <span key={`${item}-${index}`} className="marquee-chip text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                <span className="marquee-dot" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="plataforma" className="px-6 py-24 md:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1440px] gap-14 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)] lg:gap-20">
          <div className="max-w-[540px]">
            <p className="section-tag">Que ordena desde el dia uno</p>
            <h2 className="mt-6 max-w-[12ch] font-[var(--font-display)] text-[clamp(2.6rem,5vw,4.5rem)] leading-[0.94] tracking-[-0.04em]">
              Gestion visible para equipos que no pueden perder ritmo.
            </h2>
            <p className="mt-6 text-lg leading-8 text-[var(--muted)]">
              La primera version de Kingestion ya nace con una narrativa clara: menos dispersion, mas lectura operativa y mas contexto util para decidir.
            </p>
          </div>

          <div className="grid gap-10">
            {pillars.map((pillar) => (
              <article key={pillar.name} className="border-t border-[var(--line)] pt-6">
                <h3 className="font-[var(--font-display)] text-[2rem] leading-none tracking-[-0.04em] text-[var(--ink)]">
                  {pillar.name}
                </h3>
                <p className="mt-4 max-w-[42rem] text-base leading-8 text-[var(--muted)] md:text-lg">
                  {pillar.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="flujo"
        className="bg-[linear-gradient(180deg,#16322f_0%,#0e2421_100%)] px-6 py-24 text-[#f3ebdf] md:px-8 lg:px-10"
      >
        <div className="mx-auto grid max-w-[1440px] gap-14 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)] lg:gap-24">
          <div className="max-w-[520px]">
            <p className="section-tag text-[#d9b79a]">Flujo</p>
            <h2 className="mt-6 max-w-[13ch] font-[var(--font-display)] text-[clamp(2.5rem,5vw,4.4rem)] leading-[0.96] tracking-[-0.04em]">
              Un recorrido que baja ruido antes de sumar complejidad.
            </h2>
            <p className="mt-6 text-lg leading-8 text-[rgba(243,235,223,0.7)]">
              La plataforma no arranca queriendo resolver todo al mismo tiempo. Arranca dejando claro donde esta cada cuenta, que sigue y quien lo toma.
            </p>
          </div>

          <div className="space-y-8">
            {flow.map((item) => (
              <article key={item.step} className="grid gap-4 border-t border-[rgba(243,235,223,0.15)] pt-6 md:grid-cols-[90px_minmax(0,1fr)]">
                <span className="font-[var(--font-display)] text-[3rem] leading-none tracking-[-0.08em] text-[#d9b79a]">
                  {item.step}
                </span>
                <div>
                  <h3 className="font-[var(--font-display)] text-[1.8rem] leading-none tracking-[-0.04em]">{item.title}</h3>
                  <p className="mt-4 max-w-[36rem] text-base leading-8 text-[rgba(243,235,223,0.72)] md:text-lg">
                    {item.text}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-24 md:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1440px] gap-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,0.95fr)] lg:items-start lg:gap-20">
          <div className="rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.4)] p-8 backdrop-blur md:p-10">
            <p className="section-tag">Alcance inicial</p>
            <h2 className="mt-6 max-w-[12ch] font-[var(--font-display)] text-[clamp(2.4rem,4vw,3.8rem)] leading-[0.95] tracking-[-0.04em]">
              Base lista para crecer sin rehacer el origen.
            </h2>
            <p className="mt-6 max-w-[34rem] text-lg leading-8 text-[var(--muted)]">
              Dejamos una primera capa publica y una estructura tecnica que ya permite seguir sumando modulos, automatizaciones y nuevos frentes del negocio.
            </p>
          </div>

          <div className="space-y-5">
            {scope.map((item, index) => (
              <div key={item} className="flex gap-5 border-b border-[var(--line)] pb-5">
                <span className="pt-1 font-[var(--font-display)] text-2xl tracking-[-0.06em] text-[var(--flare)]">
                  0{index + 1}
                </span>
                <p className="text-base leading-8 text-[var(--ink)] md:text-lg">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contacto" className="px-6 pb-24 pt-6 md:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1440px] gap-10 rounded-[2.4rem] border border-[var(--line)] bg-[rgba(255,255,255,0.48)] p-8 backdrop-blur md:p-10 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1fr)] lg:gap-14">
          <div className="max-w-[520px]">
            <p className="section-tag">Contacto</p>
            <h2 className="mt-6 max-w-[11ch] font-[var(--font-display)] text-[clamp(2.7rem,5vw,4rem)] leading-[0.96] tracking-[-0.04em]">
              Dejemos armado el primer recorrido de Kingestion.
            </h2>
            <p className="mt-6 text-lg leading-8 text-[var(--muted)]">
              Esta primera web ya puede captar interesados y dejar registro en Supabase. Desde aca podemos seguir iterando modulos, automatizaciones y despliegues.
            </p>
            <div className="mt-10 border-t border-[var(--line)] pt-6 text-sm leading-7 text-[var(--muted)]">
              Si completas el formulario, la solicitud queda lista para trabajarse desde una siguiente capa de producto o backoffice.
            </div>
          </div>

          <ContactForm />
        </div>
      </section>

      <footer className="px-6 pb-10 md:px-8 lg:px-10">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 border-t border-[var(--line)] pt-5 text-sm text-[var(--muted)] md:flex-row md:items-center md:justify-between">
          <span>Kingestion - primera base visual, tecnica y publicable</span>
          <span>Next.js - Supabase - Vercel</span>
        </div>
      </footer>
    </main>
  );
}
