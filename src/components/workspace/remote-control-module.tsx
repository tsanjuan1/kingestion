"use client";

import { useEffect, useMemo, useState } from "react";

import { SectionPanel } from "@/components/workspace/section-panel";
import { useKingestion } from "@/components/workspace/kingestion-provider";
import type { AutomationCloudStatus, AutomationTriggerResult } from "@/lib/kingston/contracts";
import { formatDateTime } from "@/lib/kingston/helpers";

async function parseErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { message?: string };
    return payload.message ?? "No pude completar la accion.";
  } catch {
    return "No pude completar la accion.";
  }
}

export function RemoteControlModule() {
  const { activeOwner, canManageModule, refreshWorkspace } = useKingestion();
  const [status, setStatus] = useState<AutomationCloudStatus | null>(null);
  const [lastTrigger, setLastTrigger] = useState<AutomationTriggerResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const canManageSettings = canManageModule("settings");

  const refreshStatus = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/automation/control/kingston-rma", {
        credentials: "include",
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const payload = (await response.json()) as AutomationCloudStatus;
      setStatus(payload);
    } catch (error) {
      setStatus(null);
      setErrorMessage(error instanceof Error ? error.message : "No pude cargar el estado de la automatizacion.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshStatus();
  }, []);

  const handlePauseToggle = async (paused: boolean) => {
    setIsActing(true);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      const response = await fetch("/api/automation/control/kingston-rma", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ paused })
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const payload = (await response.json()) as AutomationCloudStatus;
      setStatus(payload);
      setFeedbackMessage(
        paused
          ? "La automatizacion nativa de Kingestion quedo pausada manualmente y no va a procesar correos ni avisos hasta que la reanudes."
          : "La automatizacion nativa de Kingestion fue reanudada y vuelve a procesar correos y avisos."
      );
      await refreshWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No pude actualizar el estado de la automatizacion.");
    } finally {
      setIsActing(false);
    }
  };

  const handleTrigger = async () => {
    setIsActing(true);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      const response = await fetch("/api/automation/trigger/kingston-rma", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const payload = (await response.json()) as AutomationTriggerResult;
      setLastTrigger(payload);
      setFeedbackMessage(payload.message);
      await Promise.all([refreshStatus(), refreshWorkspace()]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No pude ejecutar la automatizacion.");
    } finally {
      setIsActing(false);
    }
  };

  const statusLabel = useMemo(() => {
    if (isLoading) {
      return "Verificando";
    }

    if (!status) {
      return "Sin estado";
    }

    return status.control.paused ? "Pausado" : "Activo";
  }, [isLoading, status]);

  return (
    <div className="workspace-grid-2">
      <SectionPanel
        title="Automatizacion Kingston"
        description="Panel nativo de Kingestion para correos, creacion de casos y avisos operativos."
      >
        <div className="space-y-4">
          <div className="workspace-empty">
            <div className="space-y-1">
              <div>
                <strong>Plataforma objetivo:</strong> Kingestion
              </div>
              <div>
                <strong>Alcance:</strong> esta automatizacion corre solo para Kingestion y no comparte nada con Anyx Comercial.
              </div>
              <div>
                <strong>Modo actual:</strong> {statusLabel}
              </div>
              <div>
                <strong>Cadencia:</strong> una corrida por hora desde Kingestion
              </div>
              <div>
                <strong>Sesion actual:</strong> {activeOwner.name}
              </div>
            </div>
          </div>

          <div className="workspace-empty">
            <div className="space-y-1">
              <div>
                <strong>Ejecucion:</strong> {status?.cloudOnly ? "Nube Kingestion" : "Pendiente"}
              </div>
              <div>
                <strong>Piloto:</strong> {status?.pilotMode ? "Activo" : "Produccion"}
              </div>
              <div>
                <strong>IA para comprobantes:</strong> {status?.proofAttachmentAiEnabled ? "Habilitada" : "Deshabilitada"}
              </div>
              <div>
                <strong>Avisos por estado:</strong> {status?.statusNotificationsEnabled ? "Habilitados" : "Deshabilitados"}
              </div>
              <div>
                <strong>Correo conectado:</strong> {status?.manualTriggerConfigured ? "Configurado" : "Falta configurar"}
              </div>
              {status?.lastRunAt ? (
                <div>
                  <strong>Ultima corrida:</strong> {formatDateTime(status.lastRunAt)}
                </div>
              ) : null}
              {typeof status?.processedMailCount === "number" ? (
                <div>
                  <strong>Correos ya deduplicados:</strong> {status.processedMailCount}
                </div>
              ) : null}
              {status?.control.pausedAt ? (
                <div>
                  <strong>Pausado desde:</strong> {formatDateTime(status.control.pausedAt)}
                </div>
              ) : null}
              {status?.control.pausedByUserName ? (
                <div>
                  <strong>Pausado por:</strong> {status.control.pausedByUserName}
                </div>
              ) : null}
              {status?.lastAutomationAuditAt ? (
                <div>
                  <strong>Ultima accion de automatizacion:</strong> {formatDateTime(status.lastAutomationAuditAt)}
                </div>
              ) : null}
              {status?.lastCaseActivityAt ? (
                <div>
                  <strong>Ultimo movimiento de casos:</strong> {formatDateTime(status.lastCaseActivityAt)}
                </div>
              ) : null}
            </div>
          </div>

          <div className="workspace-inline-actions">
            <button
              className="workspace-button"
              type="button"
              onClick={() => void handlePauseToggle(!(status?.control.paused ?? false))}
              disabled={isActing || !canManageSettings || isLoading || !status}
            >
              {isActing
                ? "Guardando..."
                : status?.control.paused
                  ? "Reanudar automatizacion"
                  : "Pausar automatizacion"}
            </button>
            <button
              className="workspace-button-secondary"
              type="button"
              onClick={() => void handleTrigger()}
              disabled={
                isActing ||
                !canManageSettings ||
                isLoading ||
                !status ||
                !status.manualTriggerConfigured ||
                status.control.paused
              }
            >
              {isActing ? "Procesando..." : "Ejecutar ahora"}
            </button>
            <button
              className="workspace-button-secondary"
              type="button"
              onClick={() => void refreshStatus()}
              disabled={isLoading}
            >
              {isLoading ? "Actualizando..." : "Actualizar estado"}
            </button>
          </div>

          {feedbackMessage ? <div className="workspace-empty">{feedbackMessage}</div> : null}
          {errorMessage ? <div className="workspace-empty">{errorMessage}</div> : null}
          {lastTrigger ? (
            <div className="workspace-empty">
              <div className="space-y-1">
                <div>
                  <strong>Ultimo disparo manual:</strong> {formatDateTime(lastTrigger.triggeredAt)}
                </div>
                <div>
                  <strong>Modo:</strong> {lastTrigger.mode}
                </div>
                <div>
                  <strong>Estado:</strong> {lastTrigger.queued ? "Ejecutado en Kingestion" : "Sin ejecucion"}
                </div>
                {typeof lastTrigger.processedMessages === "number" ? (
                  <div>
                    <strong>Correos procesados:</strong> {lastTrigger.processedMessages}
                  </div>
                ) : null}
                {typeof lastTrigger.createdCases === "number" ? (
                  <div>
                    <strong>Casos creados:</strong> {lastTrigger.createdCases}
                  </div>
                ) : null}
                {typeof lastTrigger.sentEmails === "number" ? (
                  <div>
                    <strong>Mails enviados:</strong> {lastTrigger.sentEmails}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </SectionPanel>

      <SectionPanel
        title="Cobertura del piloto"
        description="Resumen de lo que ya queda contemplado dentro de Kingestion sin tocar el workflow operativo."
      >
        <div className="space-y-3">
          <article className="workspace-list-card">
            <div className="text-base font-semibold text-white">Ingesta de correos</div>
            <p className="mt-2 text-sm leading-7 text-white/64">
              Lee autorizaciones y seguimientos desde la carpeta de correo Kingston, crea casos nuevos o actualiza casos existentes en Kingestion sin duplicar el ticket.
            </p>
          </article>

          <article className="workspace-list-card">
            <div className="text-base font-semibold text-white">Adjuntos y comprobantes</div>
            <p className="mt-2 text-sm leading-7 text-white/64">
              El piloto queda preparado para interpretar comprobantes de pago o reintegro con IA y adjuntarlos directamente al caso correcto dentro de Kingestion.
            </p>
          </article>

          <article className="workspace-list-card">
            <div className="text-base font-semibold text-white">Avisos por estado</div>
            <p className="mt-2 text-sm leading-7 text-white/64">
              Mantiene los correos operativos heredados del circuito anterior, pero adaptados a los estados actuales de Kingestion sin modificar tus pantallas ni tus reglas.
            </p>
          </article>

          <article className="workspace-list-card">
            <div className="text-base font-semibold text-white">Control manual</div>
            <p className="mt-2 text-sm leading-7 text-white/64">
              Si surge un inconveniente, el administrador puede pausar el piloto desde esta misma pantalla y reanudarlo luego sin depender de nada local.
            </p>
          </article>
        </div>
      </SectionPanel>
    </div>
  );
}
