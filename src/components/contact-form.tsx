"use client";

import { useState, useTransition } from "react";

type FormState = {
  name: string;
  email: string;
  company: string;
  phone: string;
  teamSize: string;
  challenge: string;
  interest: "demo" | "diagnostico" | "implementacion";
};

const initialState: FormState = {
  name: "",
  email: "",
  company: "",
  phone: "",
  teamSize: "",
  challenge: "",
  interest: "demo"
};

export function ContactForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/contact", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(form)
        });

        const data = (await response.json()) as { message?: string };

        if (!response.ok) {
          throw new Error(data.message ?? "No pudimos enviar el formulario.");
        }

        setFeedback(data.message ?? "Solicitud enviada.");
        setForm(initialState);
      } catch (submissionError) {
        setError(
          submissionError instanceof Error
            ? submissionError.message
            : "No pudimos enviar el formulario."
        );
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="panel-sheen relative overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.64)] p-6 md:p-7"
    >
      <div className="relative z-10 space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Nombre
            </span>
            <input
              className="form-input"
              name="name"
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Tu nombre"
              autoComplete="name"
              minLength={2}
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Email
            </span>
            <input
              className="form-input"
              type="email"
              name="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              placeholder="tu@empresa.com"
              autoComplete="email"
              required
            />
          </label>
        </div>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_180px]">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Empresa
            </span>
            <input
              className="form-input"
              name="company"
              value={form.company}
              onChange={(event) => updateField("company", event.target.value)}
              placeholder="Nombre de la empresa"
              autoComplete="organization"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Equipo
            </span>
            <input
              className="form-input"
              name="teamSize"
              value={form.teamSize}
              onChange={(event) => updateField("teamSize", event.target.value)}
              placeholder="5-20"
            />
          </label>
        </div>

        <div className="grid gap-5 md:grid-cols-[180px_minmax(0,1fr)]">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Telefono
            </span>
            <input
              className="form-input"
              name="phone"
              value={form.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              placeholder="+54..."
              autoComplete="tel"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Necesidad inicial
            </span>
            <select
              className="form-select"
              name="interest"
              value={form.interest}
              onChange={(event) =>
                updateField("interest", event.target.value as FormState["interest"])
              }
            >
              <option value="demo">Primera demo</option>
              <option value="diagnostico">Diagnostico operativo</option>
              <option value="implementacion">Implementacion</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Que queres ordenar primero
          </span>
          <textarea
            className="form-textarea"
            name="challenge"
            value={form.challenge}
            onChange={(event) => updateField("challenge", event.target.value)}
            placeholder="Contanos que hoy esta disperso, que seguimiento se pierde o que lectura te falta."
            minLength={20}
            maxLength={1000}
            required
          />
        </label>

        <div className="flex flex-col gap-4 pt-2 md:flex-row md:items-center md:justify-between">
          <div className="text-sm leading-7 text-[var(--muted)]">
            El envio registra el lead en Supabase para seguir el contacto desde la siguiente capa del producto.
          </div>
          <button type="submit" className="cta-button min-w-[210px]" disabled={isPending}>
            {isPending ? "Enviando..." : "Registrar interes"}
          </button>
        </div>

        {feedback ? <p className="text-sm font-medium text-[var(--brand-strong)]">{feedback}</p> : null}
        {error ? <p className="text-sm font-medium text-[#a34729]">{error}</p> : null}
      </div>
    </form>
  );
}
