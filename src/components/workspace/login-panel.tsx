"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type LoginPanelProps = {
  needsBootstrap: boolean;
  blocked: boolean;
};

const brandLogo = "/kingestion-logo-v3.svg?v=20260514";

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
    <main className="min-h-screen bg-white text-[var(--text)]">
      <div className="grid min-h-screen bg-white md:grid-cols-[minmax(0,1fr)_minmax(360px,500px)]">
        <section className="flex min-h-[52vh] flex-col justify-between border-b border-[#e6e9ee] bg-[#f8fafc] px-6 py-7 text-[var(--text)] md:min-h-screen md:border-r md:border-b-0 md:px-10 lg:px-14">
          <div>
          <img src={brandLogo} alt="Kingestion" className="h-auto w-[13.5rem] max-w-full object-contain" />
          <h1 className="mt-10 max-w-[34rem] font-[var(--font-display)] text-[2.35rem] leading-[1.04] tracking-[-0.035em] text-[#111827] md:text-[2.75rem]">
            Gestion de casos Kingston
          </h1>
          <p className="mt-4 max-w-[34rem] text-sm leading-7 text-[#5f6876]">
            Plataforma interna para gestion de casos Kingston.
          </p>
          </div>
        </section>

        <section className="flex min-h-[48vh] items-start bg-white px-6 py-7 md:min-h-screen md:items-center md:px-8 lg:px-10">
          <div className="w-full">
          <div className="workspace-kicker">{needsBootstrap ? "Administrador inicial" : "Acceso"}</div>
          <h2 className="mt-3 text-2xl font-[var(--font-display)] tracking-[-0.035em] text-[var(--text)]">
            {needsBootstrap ? "Crear administrador" : "Ingresar"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--muted-faint)]">
            {needsBootstrap
              ? "Todavia no existe ningun usuario. Crea tu cuenta administradora para empezar a operar la plataforma."
              : "Ingresa con tus credenciales para acceder a los modulos permitidos."}
          </p>

          {error ? <div className="workspace-empty mt-6">{error}</div> : null}

          {needsBootstrap ? (
            <form className="mt-6 space-y-4" onSubmit={handleBootstrap}>
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
            <form className="mt-6 space-y-4" onSubmit={handleLogin}>
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
          </div>
        </section>
      </div>
    </main>
  );
}
