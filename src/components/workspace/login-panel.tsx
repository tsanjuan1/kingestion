"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type LoginPanelProps = {
  needsBootstrap: boolean;
  blocked: boolean;
};

async function submitJson(url: string, payload: object) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify(payload)
  });

  const body = (await response.json()) as { message?: string };

  if (!response.ok) {
    throw new Error(body.message ?? "No pude completar la solicitud.");
  }
}

export function LoginPanel({ needsBootstrap, blocked }: LoginPanelProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(blocked ? "Tu usuario esta inactivo." : null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: ""
  });
  const [bootstrapForm, setBootstrapForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  });

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await submitJson("/api/auth/login", loginForm);
      router.push("/dashboard");
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "No pude iniciar sesion.");
      setIsSubmitting(false);
    }
  };

  const handleBootstrap = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await submitJson("/api/auth/bootstrap", bootstrapForm);
      router.push("/dashboard");
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "No pude crear el administrador.");
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#edf4fa_0%,#dfe9f7_100%)] px-4 py-8 text-[var(--text)]">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl gap-6 rounded-[1.6rem] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] md:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[1.2rem] border border-[var(--color-line-soft)] bg-[linear-gradient(180deg,#0d4f92_0%,#0a3a6d_100%)] p-6 text-white">
          <img src="/kingestion-logo.png" alt="Kingestion" className="h-auto w-[16rem] max-w-full object-contain" />
          <h1 className="mt-8 font-[var(--font-display)] text-5xl leading-none tracking-[-0.08em] text-white">
            Gestion de casos Kingston
          </h1>
          <p className="mt-5 max-w-[34rem] text-base leading-8 text-white/78">
            Plataforma interna para ANYX con casos, reintegros, pendientes de compras, pendientes de servicio tecnico y reportes.
          </p>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {[
              ["Casos", "Bandeja simple por zona y estado."],
              ["Permisos", "Usuarios con accesos por modulo."],
              ["Base compartida", "Mismos datos desde cualquier equipo."]
            ].map(([title, description]) => (
              <article key={title} className="rounded-[1rem] border border-white/12 bg-white/8 px-4 py-4">
                <div className="text-lg font-semibold text-white">{title}</div>
                <p className="mt-2 text-sm leading-7 text-white/72">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[1.2rem] border border-[var(--line)] bg-[var(--panel-soft)] p-6">
          <div className="workspace-kicker">{needsBootstrap ? "Administrador inicial" : "Acceso"}</div>
          <h2 className="mt-3 text-3xl font-[var(--font-display)] tracking-[-0.06em] text-[var(--text)]">
            {needsBootstrap ? "Crear administrador" : "Ingresar"}
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted-faint)]">
            {needsBootstrap
              ? "Todavia no existe ningun usuario. Crea tu cuenta administradora para empezar a operar la plataforma."
              : "Ingresa con tus credenciales para acceder a los modulos permitidos."}
          </p>

          {error ? <div className="workspace-empty mt-6">{error}</div> : null}

          {needsBootstrap ? (
            <form className="mt-8 space-y-5" onSubmit={handleBootstrap}>
              <label className="workspace-label">
                <span>Nombre completo</span>
                <input
                  className="workspace-input"
                  value={bootstrapForm.name}
                  onChange={(event) => setBootstrapForm((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </label>
              <label className="workspace-label">
                <span>Email</span>
                <input
                  className="workspace-input"
                  type="email"
                  value={bootstrapForm.email}
                  onChange={(event) => setBootstrapForm((current) => ({ ...current, email: event.target.value }))}
                  required
                />
              </label>
              <label className="workspace-label">
                <span>Contrasena</span>
                <input
                  className="workspace-input"
                  type="password"
                  value={bootstrapForm.password}
                  onChange={(event) => setBootstrapForm((current) => ({ ...current, password: event.target.value }))}
                  required
                />
              </label>
              <label className="workspace-label">
                <span>Repetir contrasena</span>
                <input
                  className="workspace-input"
                  type="password"
                  value={bootstrapForm.confirmPassword}
                  onChange={(event) =>
                    setBootstrapForm((current) => ({ ...current, confirmPassword: event.target.value }))
                  }
                  required
                />
              </label>

              <button className="workspace-button w-full justify-center" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creando..." : "Crear administrador"}
              </button>
            </form>
          ) : (
            <form className="mt-8 space-y-5" onSubmit={handleLogin}>
              <label className="workspace-label">
                <span>Email</span>
                <input
                  className="workspace-input"
                  type="email"
                  value={loginForm.email}
                  onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                  required
                />
              </label>
              <label className="workspace-label">
                <span>Contrasena</span>
                <input
                  className="workspace-input"
                  type="password"
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                  required
                />
              </label>

              <button className="workspace-button w-full justify-center" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Ingresando..." : "Entrar al sistema"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
