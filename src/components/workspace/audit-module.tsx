"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { ModuleSubnav } from "@/components/workspace/module-subnav";
import { SectionPanel } from "@/components/workspace/section-panel";
import { useKingestion } from "@/components/workspace/kingestion-provider";
import { formatDateTime, getAuditActionLabel } from "@/lib/kingston/helpers";
import type { UserInteractionLog } from "@/lib/kingston/types";

type AuditView = "actividad" | "correos";

type EmailHistoryItem = {
  id: string;
  to: string[];
  cc: string[];
  subject: string;
  textPreview: string;
  status: "pending" | "sending" | "sent" | "error" | "failed";
  attempts: number;
  lastError: string | null;
  source: string;
  caseId: string | null;
  mailboxUid: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  sentAt: string | null;
};

function getAuditView(value: string | null): AuditView {
  return value === "correos" ? "correos" : "actividad";
}

function getEmailStatusLabel(status: EmailHistoryItem["status"]) {
  switch (status) {
    case "sent":
      return "Enviado";
    case "sending":
      return "Enviando";
    case "error":
      return "Error / reintento";
    case "failed":
      return "Fallido";
    default:
      return "Pendiente";
  }
}

function getEmailSourceLabel(source: string) {
  switch (source) {
    case "status-notification":
      return "Cambio de estado";
    case "mail-reply":
      return "Respuesta automatica";
    case "new-case-customer":
      return "Alta de caso";
    default:
      return source || "Automatizacion";
  }
}

function formatOptionalDateTime(value: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Sin fecha" : formatDateTime(value);
}

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchesAuditSearch(entry: UserInteractionLog, query: string) {
  if (!query) {
    return true;
  }

  return normalizeSearchValue(
    [
      formatDateTime(entry.createdAt),
      entry.actorName,
      getAuditActionLabel(entry.action),
      entry.action,
      entry.detail,
      entry.entityType,
      entry.entityId
    ].join(" ")
  ).includes(query);
}

function matchesEmailSearch(entry: EmailHistoryItem, query: string) {
  if (!query) {
    return true;
  }

  return normalizeSearchValue(
    [
      formatOptionalDateTime(entry.sentAt ?? entry.updatedAt ?? entry.createdAt),
      getEmailStatusLabel(entry.status),
      getEmailSourceLabel(entry.source),
      entry.to.join(" "),
      entry.cc.join(" "),
      entry.subject,
      entry.textPreview,
      entry.lastError ?? "",
      entry.caseId ?? "",
      entry.mailboxUid ? String(entry.mailboxUid) : ""
    ].join(" ")
  ).includes(query);
}

export function AuditModule() {
  const searchParams = useSearchParams();
  const view = getAuditView(searchParams.get("view"));
  const { auditLog, canAccessModule } = useKingestion();
  const [searchQuery, setSearchQuery] = useState("");
  const [emailHistory, setEmailHistory] = useState<EmailHistoryItem[]>([]);
  const [emailHistoryError, setEmailHistoryError] = useState<string | null>(null);
  const [isLoadingEmailHistory, setIsLoadingEmailHistory] = useState(false);
  const normalizedSearchQuery = normalizeSearchValue(searchQuery);
  const filteredAuditLog = auditLog.filter((entry) => matchesAuditSearch(entry, normalizedSearchQuery));
  const filteredEmailHistory = emailHistory.filter((entry) => matchesEmailSearch(entry, normalizedSearchQuery));
  const searchBox = (
    <label className="workspace-compact-search">
      <span className="sr-only">Buscar auditoria</span>
      <input
        type="search"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder="Buscar"
      />
    </label>
  );

  useEffect(() => {
    if (view !== "correos") return;

    let cancelled = false;

    const loadEmailHistory = async () => {
      setIsLoadingEmailHistory(true);
      setEmailHistoryError(null);

      try {
        const response = await fetch("/api/automation/emails?limit=200", {
          cache: "no-store",
          credentials: "include"
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(payload?.message ?? "No pude cargar el historial de correos.");
        }

        const payload = (await response.json()) as { items: EmailHistoryItem[] };
        if (!cancelled) {
          setEmailHistory(payload.items);
        }
      } catch (error) {
        if (!cancelled) {
          setEmailHistoryError(error instanceof Error ? error.message : "No pude cargar el historial de correos.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingEmailHistory(false);
        }
      }
    };

    void loadEmailHistory();

    return () => {
      cancelled = true;
    };
  }, [view]);

  if (!canAccessModule("audit")) {
    return (
      <div className="workspace-page">
        <SectionPanel title="Sin permisos" description="Tu usuario no tiene acceso al modulo Auditoria.">
          <div className="workspace-empty">Pedi al administrador que revise tus permisos.</div>
        </SectionPanel>
      </div>
    );
  }

  return (
    <div className="workspace-page">
      <ModuleSubnav
        items={[
          { href: "/audit?view=actividad", label: "Actividad", active: view === "actividad" },
          { href: "/audit?view=correos", label: "Correos", active: view === "correos" }
        ]}
      />

      {view === "actividad" ? (
        <SectionPanel
          title="Registro de actividad"
          description="Quien interactuo, a que hora y sobre que entidad."
          aside={searchBox}
        >
          {filteredAuditLog.length === 0 ? (
            <div className="workspace-empty">
              {auditLog.length === 0 ? "Todavia no hay acciones registradas." : "No hay actividad que coincida con la busqueda."}
            </div>
          ) : (
            <div className="workspace-table-wrap">
              <table className="workspace-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Usuario</th>
                    <th>Accion</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAuditLog.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDateTime(entry.createdAt)}</td>
                      <td>{entry.actorName}</td>
                      <td>{getAuditActionLabel(entry.action)}</td>
                      <td>{entry.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionPanel>
      ) : null}

      {view === "correos" ? (
        <SectionPanel
          title="Historial de correos automaticos"
          description="Mails encolados, enviados o pendientes de reintento por la automatizacion de Kingestion."
          aside={searchBox}
        >
          {emailHistoryError ? <div className="workspace-empty">{emailHistoryError}</div> : null}
          {isLoadingEmailHistory ? <div className="workspace-empty">Cargando historial de correos...</div> : null}
          {!isLoadingEmailHistory && filteredEmailHistory.length === 0 && !emailHistoryError ? (
            <div className="workspace-empty">
              {emailHistory.length === 0
                ? "Todavia no hay correos automaticos registrados."
                : "No hay correos que coincidan con la busqueda."}
            </div>
          ) : null}

          {filteredEmailHistory.length > 0 ? (
            <div className="workspace-table-wrap">
              <table className="workspace-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th>Origen</th>
                    <th>Para</th>
                    <th>Asunto</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmailHistory.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatOptionalDateTime(entry.sentAt ?? entry.updatedAt ?? entry.createdAt)}</td>
                      <td>{getEmailStatusLabel(entry.status)}</td>
                      <td>{getEmailSourceLabel(entry.source)}</td>
                      <td>{entry.to.join(", ")}</td>
                      <td>
                        <div className="font-medium text-white">{entry.subject}</div>
                        <div className="workspace-case-meta">
                          Intentos: {entry.attempts}
                          {entry.mailboxUid ? ` / UID ${entry.mailboxUid}` : ""}
                          {entry.caseId ? ` / Caso ${entry.caseId}` : ""}
                        </div>
                      </td>
                      <td>{entry.lastError ?? entry.textPreview}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </SectionPanel>
      ) : null}
    </div>
  );
}
