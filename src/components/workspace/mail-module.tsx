"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useKingestion } from "@/components/workspace/kingestion-provider";

type MailListItem = {
  uid: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  date: string | null;
  size: number | null;
  seen: boolean;
  answered: boolean;
  attachmentCount: number;
};

type MailAttachment = {
  index: number;
  name: string;
  mimeType: string;
  size: number;
};

type MailMessage = MailListItem & {
  messageId: string | null;
  to: string[];
  cc: string[];
  replyTo: string[];
  text: string;
  html: string | null;
  attachments: MailAttachment[];
};

type MailListResponse = {
  folder: string;
  count: number;
  items: MailListItem[];
  automationError?: string | null;
};

const MAIL_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatSize(value: number | null) {
  if (!value) return "";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatRefreshInterval(value: number) {
  const minutes = Math.max(1, Math.round(value / 60_000));
  return `${minutes} min`;
}

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "CO";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

async function parseApiError(response: Response) {
  try {
    const payload = (await response.json()) as { message?: string };
    return payload.message ?? "No pude completar la accion.";
  } catch {
    return "No pude completar la accion.";
  }
}

export function MailModule() {
  const { canAccessModule, canManageModule } = useKingestion();
  const [messages, setMessages] = useState<MailListItem[]>([]);
  const [folder, setFolder] = useState("Casos kingston");
  const [mailboxCount, setMailboxCount] = useState(0);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<MailMessage | null>(null);
  const [query, setQuery] = useState("");
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingMessage, setIsLoadingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState("");
  const [replyCc, setReplyCc] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent">("idle");
  const [isComposing, setIsComposing] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeCc, setComposeCc] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeState, setComposeState] = useState<"idle" | "sending" | "sent">("idle");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const selectedUidRef = useRef<string | null>(null);
  const isLoadingListRef = useRef(false);

  const canManageMail = canManageModule("mail");

  const filteredMessages = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return messages;

    return messages.filter((message) =>
      [message.subject, message.fromName, message.fromEmail]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [messages, query]);

  useEffect(() => {
    selectedUidRef.current = selectedUid;
  }, [selectedUid]);

  const loadMessages = async (options: { silent?: boolean } = {}) => {
    if (isLoadingListRef.current) return;

    isLoadingListRef.current = true;
    if (options.silent) {
      setIsAutoRefreshing(true);
    } else {
      setIsLoadingList(true);
    }
    setError(null);

    try {
      const response = await fetch("/api/mail/messages?limit=80", {
        cache: "no-store",
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const payload = (await response.json()) as MailListResponse;
      setMessages(payload.items);
      setFolder(payload.folder);
      setMailboxCount(payload.count);
      setLastUpdatedAt(new Date().toISOString());
      if (payload.automationError) {
        setError(`La bandeja se actualizo, pero la automatizacion no pudo correr: ${payload.automationError}`);
      }

      if (!selectedUidRef.current && payload.items[0]) {
        setSelectedUid(payload.items[0].uid);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No pude cargar la bandeja.");
    } finally {
      isLoadingListRef.current = false;
      setIsLoadingList(false);
      setIsAutoRefreshing(false);
    }
  };

  useEffect(() => {
    void loadMessages();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadMessages({ silent: true });
      }
    }, MAIL_REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadMessages({ silent: true });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!selectedUid) {
      setSelectedMessage(null);
      return;
    }

    const loadMessage = async () => {
      setIsLoadingMessage(true);
      setError(null);

      try {
        const response = await fetch(`/api/mail/messages/${encodeURIComponent(selectedUid)}`, {
          cache: "no-store",
          credentials: "include"
        });

        if (!response.ok) {
          throw new Error(await parseApiError(response));
        }

        const payload = (await response.json()) as { item: MailMessage };
        setSelectedMessage(payload.item);
        setReplyTo(payload.item.replyTo[0] || payload.item.fromEmail);
        setReplyCc("");
        setReplyBody("");
        setSendState("idle");
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "No pude abrir el correo.");
      } finally {
        setIsLoadingMessage(false);
      }
    };

    void loadMessage();
  }, [selectedUid]);

  if (!canAccessModule("mail")) {
    return (
      <div className="workspace-page">
        <section className="workspace-panel">
          <p className="workspace-kicker">Correo</p>
          <h1 className="workspace-panel-title">No tenes acceso al modulo Correo</h1>
        </section>
      </div>
    );
  }

  const handleReply = async () => {
    if (!selectedMessage || !replyBody.trim() || sendState === "sending") return;

    setSendState("sending");
    setError(null);

    try {
      const response = await fetch(`/api/mail/messages/${encodeURIComponent(selectedMessage.uid)}/reply`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          to: replyTo,
          cc: replyCc,
          body: replyBody
        })
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      setSendState("sent");
      setReplyBody("");
      await loadMessages();
    } catch (sendError) {
      setSendState("idle");
      setError(sendError instanceof Error ? sendError.message : "No pude enviar la respuesta.");
    }
  };

  const handleCompose = async () => {
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim() || composeState === "sending") return;

    setComposeState("sending");
    setError(null);

    try {
      const response = await fetch("/api/mail/send", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          to: composeTo,
          cc: composeCc,
          subject: composeSubject,
          body: composeBody
        })
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      setComposeState("sent");
      setComposeTo("");
      setComposeCc("");
      setComposeSubject("");
      setComposeBody("");
      await loadMessages();
    } catch (sendError) {
      setComposeState("idle");
      setError(sendError instanceof Error ? sendError.message : "No pude enviar el correo.");
    }
  };

  return (
    <div className="workspace-page workspace-mail-page">
      <div className="workspace-mail-toolbar">
        <div>
          <p className="workspace-kicker">Correo</p>
          <h1 className="workspace-mail-title">Bandeja de casos Kingston</h1>
        </div>
        <div className="workspace-mail-toolbar-actions">
          <input
            className="workspace-search-input workspace-mail-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar remitente o asunto"
          />
          <button className="workspace-button-secondary" type="button" onClick={() => void loadMessages()}>
            Actualizar
          </button>
          <button
            className="workspace-button"
            type="button"
            onClick={() => {
              setIsComposing(true);
              setComposeState("idle");
            }}
            disabled={!canManageMail}
          >
            Nuevo correo
          </button>
        </div>
      </div>

      {error ? <div className="workspace-empty workspace-mail-error">{error}</div> : null}

      <section className="workspace-mail-shell">
        <aside className="workspace-mail-folders">
          <button type="button" className="workspace-mail-folder workspace-mail-folder-active">
            <span>Bandeja Kingston</span>
            <strong>{mailboxCount}</strong>
          </button>
          <div className="workspace-mail-folder-note">
            Carpeta: <strong>{folder}</strong>
            <span>
              Actualizacion automatica cada {formatRefreshInterval(MAIL_REFRESH_INTERVAL_MS)}.
              {lastUpdatedAt ? ` Ultima: ${formatDate(lastUpdatedAt)}.` : ""}
            </span>
          </div>
        </aside>

        <div className="workspace-mail-list">
          <div className="workspace-mail-list-head">
            <span>{isLoadingList ? "Cargando..." : `${filteredMessages.length} correos`}</span>
            <span>{isAutoRefreshing ? "Sincronizando" : "En vivo"}</span>
          </div>

          {filteredMessages.length === 0 ? (
            <div className="workspace-mail-empty">
              {isLoadingList ? "Cargando bandeja..." : "No hay correos para mostrar en esta carpeta."}
            </div>
          ) : (
            filteredMessages.map((message) => (
              <button
                key={message.uid}
                type="button"
                className={`workspace-mail-row ${selectedUid === message.uid ? "workspace-mail-row-active" : ""}`}
                onClick={() => {
                  setIsComposing(false);
                  setSelectedUid(message.uid);
                }}
              >
                <span className="workspace-mail-avatar">{getInitials(message.fromName)}</span>
                <span className="workspace-mail-row-main">
                  <span className="workspace-mail-row-top">
                    <strong>{message.fromName}</strong>
                    <span>{formatDate(message.date)}</span>
                  </span>
                  <span className="workspace-mail-subject">{message.subject}</span>
                  <span className="workspace-mail-meta">
                    {message.fromEmail || "Sin email"} {message.attachmentCount ? `/ ${message.attachmentCount} adj.` : ""}
                  </span>
                </span>
                <span className="workspace-mail-status">{message.answered ? "Respondido" : message.seen ? "Leido" : "Nuevo"}</span>
              </button>
            ))
          )}
        </div>

        <article className="workspace-mail-reader">
          {isComposing ? (
            <section className="workspace-mail-reply">
              <div className="workspace-panel-header">
                <div>
                  <p className="workspace-kicker">Nuevo correo</p>
                  <h3>Enviar desde Kingestion</h3>
                </div>
              </div>

              <div className="workspace-form-grid">
                <label className="workspace-label">
                  <span>Para</span>
                  <input
                    className="workspace-input"
                    value={composeTo}
                    onChange={(event) => setComposeTo(event.target.value)}
                    disabled={!canManageMail}
                    placeholder="cliente@empresa.com"
                  />
                </label>
                <label className="workspace-label">
                  <span>CC</span>
                  <input
                    className="workspace-input"
                    value={composeCc}
                    onChange={(event) => setComposeCc(event.target.value)}
                    disabled={!canManageMail}
                  />
                </label>
              </div>

              <label className="workspace-label">
                <span>Asunto</span>
                <input
                  className="workspace-input"
                  value={composeSubject}
                  onChange={(event) => setComposeSubject(event.target.value)}
                  disabled={!canManageMail}
                  placeholder="Asunto del correo"
                />
              </label>

              <label className="workspace-label">
                <span>Mensaje</span>
                <textarea
                  className="workspace-textarea workspace-mail-reply-textarea"
                  value={composeBody}
                  onChange={(event) => setComposeBody(event.target.value)}
                  disabled={!canManageMail}
                  placeholder={canManageMail ? "Escribi el correo..." : "Tu usuario no tiene permiso para enviar."}
                />
              </label>

              <div className="workspace-mail-reply-actions">
                {composeState === "sent" ? <span className="workspace-mail-sent">Correo enviado.</span> : null}
                <button
                  className="workspace-button-secondary"
                  type="button"
                  onClick={() => setIsComposing(false)}
                  disabled={composeState === "sending"}
                >
                  Cancelar
                </button>
                <button
                  className="workspace-button"
                  type="button"
                  onClick={() => void handleCompose()}
                  disabled={
                    !canManageMail ||
                    composeState === "sending" ||
                    !composeTo.trim() ||
                    !composeSubject.trim() ||
                    !composeBody.trim()
                  }
                >
                  {composeState === "sending" ? "Enviando..." : "Enviar correo"}
                </button>
              </div>
            </section>
          ) : !selectedUid ? (
            <div className="workspace-mail-empty">Selecciona un correo para verlo.</div>
          ) : isLoadingMessage ? (
            <div className="workspace-mail-empty">Abriendo correo...</div>
          ) : selectedMessage ? (
            <>
              <header className="workspace-mail-reader-head">
                <div>
                  <p className="workspace-kicker">Mensaje</p>
                  <h2>{selectedMessage.subject}</h2>
                </div>
                <span className="workspace-mail-status workspace-mail-status-large">
                  {selectedMessage.answered ? "Respondido" : selectedMessage.seen ? "Leido" : "Nuevo"}
                </span>
              </header>

              <div className="workspace-mail-headers">
                <div>
                  <span>De</span>
                  <strong>{selectedMessage.fromName}</strong>
                  <small>{selectedMessage.fromEmail}</small>
                </div>
                <div>
                  <span>Fecha</span>
                  <strong>{formatDate(selectedMessage.date)}</strong>
                  <small>{formatSize(selectedMessage.size)}</small>
                </div>
                <div>
                  <span>Para</span>
                  <strong>{selectedMessage.to.join(", ") || "Sin destinatario"}</strong>
                </div>
              </div>

              {selectedMessage.attachments.length > 0 ? (
                <div className="workspace-mail-attachments">
                  {selectedMessage.attachments.map((attachment) => (
                    <a
                      key={attachment.index}
                      className="workspace-mail-attachment"
                      href={`/api/mail/messages/${encodeURIComponent(selectedMessage.uid)}/attachments/${attachment.index}`}
                    >
                      <span>{attachment.name}</span>
                      <small>{attachment.mimeType} / {formatSize(attachment.size)}</small>
                    </a>
                  ))}
                </div>
              ) : null}

              <div className="workspace-mail-body">
                <pre>{selectedMessage.text || "El correo no tiene texto legible."}</pre>
              </div>

              <section className="workspace-mail-reply">
                <div className="workspace-panel-header">
                  <div>
                    <p className="workspace-kicker">Respuesta</p>
                    <h3>Responder desde Kingestion</h3>
                  </div>
                </div>

                <div className="workspace-form-grid">
                  <label className="workspace-label">
                    <span>Para</span>
                    <input
                      className="workspace-input"
                      value={replyTo}
                      onChange={(event) => setReplyTo(event.target.value)}
                      disabled={!canManageMail}
                    />
                  </label>
                  <label className="workspace-label">
                    <span>CC</span>
                    <input
                      className="workspace-input"
                      value={replyCc}
                      onChange={(event) => setReplyCc(event.target.value)}
                      disabled={!canManageMail}
                    />
                  </label>
                </div>

                <label className="workspace-label">
                  <span>Mensaje</span>
                  <textarea
                    className="workspace-textarea workspace-mail-reply-textarea"
                    value={replyBody}
                    onChange={(event) => setReplyBody(event.target.value)}
                    disabled={!canManageMail}
                    placeholder={canManageMail ? "Escribi la respuesta..." : "Tu usuario no tiene permiso para responder."}
                  />
                </label>

                <div className="workspace-mail-reply-actions">
                  {sendState === "sent" ? <span className="workspace-mail-sent">Respuesta enviada.</span> : null}
                  <button
                    className="workspace-button"
                    type="button"
                    onClick={() => void handleReply()}
                    disabled={!canManageMail || sendState === "sending" || !replyBody.trim()}
                  >
                    {sendState === "sending" ? "Enviando..." : "Enviar respuesta"}
                  </button>
                </div>
              </section>
            </>
          ) : (
            <div className="workspace-mail-empty">No pude abrir el correo seleccionado.</div>
          )}
        </article>
      </section>
    </div>
  );
}
