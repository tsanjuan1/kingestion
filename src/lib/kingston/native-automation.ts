import "server-only";

import type {
  AutomationTriggerResult,
  CaseAttachmentInput,
  CreateCaseInput
} from "@/lib/kingston/contracts";
import {
  getAutomationActivity,
  getAutomationCase,
  getKingestionAutomationControlState,
  getKingestionSystemSetting,
  saveKingestionAttachmentBlob,
  claimDueKingestionEmails,
  listAutomationOwners,
  listAutomationCases,
  markKingestionEmailFailed,
  markKingestionEmailSent,
  patchAutomationCase,
  queueKingestionEmail,
  recordKingestionAutomationAudit,
  upsertKingestionSystemSetting,
  withKingestionAdvisoryLock,
  createAutomationCase
} from "@/lib/kingston/server";
import {
  buildKingstonMailboxReplyDraft,
  getKingestionMailboxAddress,
  getKingstonMailboxAttachment,
  getKingstonMailboxMessage,
  listKingstonMailboxMessages,
  markKingstonMailboxMessageAnswered,
  sendKingestionEmail
} from "@/lib/kingston/mail";
import { interpretKingstonMailWithAi, interpretReimbursementMissingFieldsWithAi } from "@/lib/kingston/mail-ai";
import { getNextActionCopy, isClosedCaseStatus } from "@/lib/kingston/helpers";
import { getDefaultPermissionsForRole } from "@/lib/kingston/data";
import type { ExternalStatus, KingstonCase, OwnerDirectoryEntry, Zone } from "@/lib/kingston/types";

const AUTOMATION_NAMESPACE = "AUTOMATION";
const NATIVE_STATE_KEY = "KINGSTON_RMA_NATIVE_AUTOMATION";
const MAX_PROCESSED_KEYS = 1200;
const DEFAULT_MAIL_LIMIT = 40;

type NativeAutomationState = {
  processedMailKeys: string[];
  processedStatusKeys: string[];
  statusBackfillInitializedAt: string | null;
  lastRunAt: string | null;
  lastSummary: NativeAutomationSummary | null;
};

type NativeAutomationSummary = {
  processedMessages: number;
  createdCases: number;
  updatedCases: number;
  sentEmails: number;
  queuedEmails: number;
  aiInterpretedMessages: number;
  reviewMessages: number;
  skippedMessages: number;
  errors: string[];
};

type ParsedKingstonMail = {
  kingstonNumber: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  failedSku: string;
  replacementSku: string;
  quantity: number;
  notes: string;
  missingFields: string[];
};

type MailMessageForAutomation = Awaited<ReturnType<typeof getKingstonMailboxMessage>>;

function createAutomationActor(): OwnerDirectoryEntry {
  return {
    id: "automation-kingestion",
    name: "Automatizacion Kingestion",
    email: process.env.KINGESTION_AUTOMATION_ACTOR_EMAIL?.trim().toLowerCase() || "automation@kingestion.local",
    team: "ADMIN",
    active: true,
    initials: "KG",
    permissions: getDefaultPermissionsForRole("ADMIN")
  };
}

function buildEmptySummary(): NativeAutomationSummary {
  return {
    processedMessages: 0,
    createdCases: 0,
    updatedCases: 0,
    sentEmails: 0,
    queuedEmails: 0,
    aiInterpretedMessages: 0,
    reviewMessages: 0,
    skippedMessages: 0,
    errors: []
  };
}

function normalizeNativeState(rawValue: unknown): NativeAutomationState {
  if (!rawValue || typeof rawValue !== "object") {
    return {
      processedMailKeys: [],
      processedStatusKeys: [],
      statusBackfillInitializedAt: null,
      lastRunAt: null,
      lastSummary: null
    };
  }

  const value = rawValue as Partial<NativeAutomationState>;
  return {
    processedMailKeys: Array.isArray(value.processedMailKeys)
      ? value.processedMailKeys.filter((entry): entry is string => typeof entry === "string")
      : [],
    processedStatusKeys: Array.isArray(value.processedStatusKeys)
      ? value.processedStatusKeys.filter((entry): entry is string => typeof entry === "string")
      : [],
    statusBackfillInitializedAt:
      typeof value.statusBackfillInitializedAt === "string" ? value.statusBackfillInitializedAt : null,
    lastRunAt: typeof value.lastRunAt === "string" ? value.lastRunAt : null,
    lastSummary: value.lastSummary && typeof value.lastSummary === "object" ? value.lastSummary : null
  };
}

async function loadNativeState() {
  const setting = await getKingestionSystemSetting(AUTOMATION_NAMESPACE, NATIVE_STATE_KEY);
  return normalizeNativeState(setting?.value_json);
}

async function saveNativeState(state: NativeAutomationState) {
  await upsertKingestionSystemSetting({
    namespace: AUTOMATION_NAMESPACE,
    key: NATIVE_STATE_KEY,
    value: state,
    description: "Estado idempotente de la automatizacion nativa de correos y avisos Kingston."
  });
}

function rememberKey(keys: string[], key: string) {
  return [key, ...keys.filter((entry) => entry !== key)].slice(0, MAX_PROCESSED_KEYS);
}

function cleanText(value: string) {
  return value
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function cleanFieldValue(value: string) {
  return value
    .replace(/<mailto:[^>]+>/gi, " ")
    .replace(/mailto:/gi, " ")
    .replace(/[<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getLineValue(lines: string[], labels: string[]) {
  const normalizedLabels = labels.map(normalizeToken);
  const match = lines.find((line) => {
    const [rawLabel] = line.split(/[:#]/);
    return rawLabel ? normalizedLabels.includes(normalizeToken(rawLabel)) : false;
  });

  if (!match) return "";
  return cleanFieldValue(match.replace(/^[^:#]+[#:]?\s*:?\s*/i, ""));
}

function extractAllEmails(value: string) {
  return Array.from(value.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)).map((match) =>
    match[0].trim().toLowerCase()
  );
}

function isInternalEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return normalized.endsWith("@anyx.com.ar") || normalized.endsWith("@innovexa.com.ar");
}

function extractPreferredEmail(value: string, fallback: string) {
  const candidates = [...extractAllEmails(value), ...extractAllEmails(fallback)];
  return candidates.find((email) => !isInternalEmail(email)) ?? candidates[0] ?? "";
}

function parseSkuAndQuantity(value: string) {
  const quantity = Number(value.match(/\((\d+)\)/)?.[1] ?? 1);
  return {
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    sku: cleanFieldValue(value.replace(/^\(\d+\)\s*/, ""))
  };
}

function inferZone(city: string, province: string): Zone {
  const normalized = normalizeToken(`${city} ${province}`);
  if (
    normalized.includes("caba") ||
    normalized.includes("capital federal") ||
    normalized.includes("ciudad autonoma") ||
    normalized.includes("buenos aires capital")
  ) {
    return "Capital / AMBA";
  }

  return "Interior / Gran Buenos Aires";
}

function normalizeKingstonNumber(value: string) {
  return value.replace(/\D/g, "").replace(/^0+/, "") || normalizeToken(value);
}

function parseKingstonAuthorizationMail(message: NonNullable<MailMessageForAutomation>): ParsedKingstonMail {
  const body = cleanText(`${message.subject}\n${message.text}`);
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const subjectCaseNumber = message.subject.match(/Kingston\s*\(([^)]+)\)/i)?.[1] ?? "";
  const caseNumber = getLineValue(lines, ["Caso", "Caso#"]) || subjectCaseNumber;
  const failed = parseSkuAndQuantity(getLineValue(lines, ["Parte", "Parte#"]));
  const replacement = parseSkuAndQuantity(getLineValue(lines, ["Reemplazo", "Producto reemplazo"]));
  const address = getLineValue(lines, ["Direccion", "Dirección"]);
  const neighborhood = getLineValue(lines, ["Barrio"]);
  const city = getLineValue(lines, ["Ciudad", "Localidad"]);
  const province = getLineValue(lines, ["Estado", "Provincia"]);
  const contactEmail = extractPreferredEmail(getLineValue(lines, ["Correo", "Email", "Mail"]), message.fromEmail);
  const contactName = getLineValue(lines, ["Nombre", "Cliente"]) || message.fromName || "Cliente Kingston";
  const postalCode = getLineValue(lines, ["Postal", "Codigo postal", "Código postal"]);
  const notes = getLineValue(lines, ["Notas", "Observaciones"]) || "Falla no informada en el correo de Kingston.";
  const missingFields: string[] = [];

  if (!caseNumber) missingFields.push("numero de caso Kingston");
  if (!contactName) missingFields.push("nombre del cliente");
  if (!contactEmail) missingFields.push("correo del cliente");
  if (!address) missingFields.push("direccion");
  if (!city) missingFields.push("ciudad");
  if (!province) missingFields.push("provincia");
  if (!failed.sku) missingFields.push("SKU fallado");
  if (!replacement.sku) missingFields.push("SKU de reemplazo");

  return {
    kingstonNumber: cleanFieldValue(caseNumber),
    contactName: cleanFieldValue(contactName),
    contactEmail,
    contactPhone: getLineValue(lines, ["Telefono", "Teléfono"]) || "Sin telefono informado",
    address: cleanFieldValue([address, neighborhood].filter(Boolean).join(", ")) || "Sin direccion informada",
    city: cleanFieldValue(city) || "Sin ciudad informada",
    province: cleanFieldValue(province) || "Sin provincia informada",
    postalCode,
    failedSku: failed.sku,
    replacementSku: replacement.sku,
    quantity: failed.quantity || replacement.quantity || 1,
    notes,
    missingFields
  };
}

function recomputeMissingFields(parsed: ParsedKingstonMail) {
  const missingFields: string[] = [];
  if (!parsed.kingstonNumber) missingFields.push("numero de caso Kingston");
  if (!parsed.contactName) missingFields.push("nombre del cliente");
  if (!parsed.contactEmail) missingFields.push("correo del cliente");
  if (!parsed.address || parsed.address === "Sin direccion informada") missingFields.push("direccion");
  if (!parsed.city || parsed.city === "Sin ciudad informada") missingFields.push("ciudad");
  if (!parsed.province || parsed.province === "Sin provincia informada") missingFields.push("provincia");
  if (!parsed.failedSku) missingFields.push("SKU fallado");
  if (!parsed.replacementSku) missingFields.push("SKU de reemplazo");
  return missingFields;
}

function mergeParsedMailWithAi(
  parsed: ParsedKingstonMail,
  ai: Awaited<ReturnType<typeof interpretKingstonMailWithAi>>
): ParsedKingstonMail {
  if (!ai.used || ai.confidence < 0.55) return parsed;

  const next: ParsedKingstonMail = {
    ...parsed,
    kingstonNumber: parsed.kingstonNumber || ai.data.kingstonNumber || "",
    contactName:
      parsed.contactName && parsed.contactName !== "Cliente Kingston"
        ? parsed.contactName
        : ai.data.contactName || parsed.contactName,
    contactEmail: parsed.contactEmail || ai.data.contactEmail || "",
    contactPhone:
      parsed.contactPhone && parsed.contactPhone !== "Sin telefono informado"
        ? parsed.contactPhone
        : ai.data.contactPhone || parsed.contactPhone,
    address:
      parsed.address && parsed.address !== "Sin direccion informada"
        ? parsed.address
        : ai.data.address || parsed.address,
    city:
      parsed.city && parsed.city !== "Sin ciudad informada"
        ? parsed.city
        : ai.data.city || parsed.city,
    province:
      parsed.province && parsed.province !== "Sin provincia informada"
        ? parsed.province
        : ai.data.province || parsed.province,
    postalCode: parsed.postalCode || ai.data.postalCode || "",
    failedSku: parsed.failedSku || ai.data.failedSku || "",
    replacementSku: parsed.replacementSku || ai.data.replacementSku || "",
    quantity: parsed.quantity || ai.data.quantity || 1,
    notes:
      parsed.notes && parsed.notes !== "Falla no informada en el correo de Kingston."
        ? parsed.notes
        : ai.data.notes || parsed.notes,
    missingFields: []
  };

  return {
    ...next,
    missingFields: recomputeMissingFields(next)
  };
}

function isLikelyKingstonMail(message: NonNullable<MailMessageForAutomation>, parsed: ParsedKingstonMail) {
  const haystack = normalizeToken(`${message.subject}\n${message.text}`);
  return Boolean(
    parsed.kingstonNumber &&
      (haystack.includes("kingston") ||
        haystack.includes("servicio de garantia") ||
        haystack.includes("garantia") ||
        haystack.includes("reemplazo"))
  );
}

function isStandardKingstonAuthorizationMail(message: NonNullable<MailMessageForAutomation>, parsed: ParsedKingstonMail) {
  const subject = normalizeToken(message.subject);
  const body = normalizeToken(message.text);
  return Boolean(
    parsed.kingstonNumber &&
      subject.includes("kingston") &&
      subject.includes("autorizacion") &&
      subject.includes("servicio de garantia") &&
      body.includes("caso") &&
      body.includes("parte") &&
      body.includes("reemplazo") &&
      body.includes("correo")
  );
}

function findCaseByKingstonNumber(cases: KingstonCase[], kingstonNumber: string) {
  const normalizedTarget = normalizeKingstonNumber(kingstonNumber);
  return cases.find((entry) => normalizeKingstonNumber(entry.kingstonNumber) === normalizedTarget) ?? null;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

type AutomationEmailDraft = {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  text: string;
  html?: string;
  inReplyTo?: string | null;
  references?: string[];
  metadata?: Record<string, unknown>;
};

function normalizeEmailForDedupe(value: string) {
  return value.trim().toLowerCase();
}

function normalizeRecipientList(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value : value ? [value] : []).map(normalizeEmailForDedupe).filter(Boolean);
}

function buildEmailDedupeKey(scope: string, parts: Array<string | number | null | undefined>) {
  return [scope, ...parts.map((part) => String(part ?? "").trim().toLowerCase())].join(":").slice(0, 420);
}

function isSafeCustomerEmail(email: string) {
  return isValidEmail(email) && !isInternalEmail(email);
}

function getTrustedAuthorizationSenderPatterns() {
  const configuredPatterns = (process.env.KINGESTION_TRUSTED_AUTHORIZATION_SENDERS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (configuredPatterns.length > 0) {
    return configuredPatterns;
  }

  return ["@anyx.com.ar", "@innovexa.com.ar", "@kingston.com"];
}

function isTrustedAuthorizationSender(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!isValidEmail(normalized)) return false;

  return getTrustedAuthorizationSenderPatterns().some((pattern) => {
    if (pattern.startsWith("@")) {
      return normalized.endsWith(pattern);
    }

    if (pattern.includes("@")) {
      return normalized === pattern;
    }

    return normalized.endsWith(`@${pattern}`);
  });
}

async function queueEmailOnce(dedupeKey: string, draft: AutomationEmailDraft, summary: NativeAutomationSummary) {
  const toRecipients = normalizeRecipientList(draft.to);
  if (toRecipients.length === 0 || toRecipients.some((recipient) => !isValidEmail(recipient))) {
    summary.errors.push(`No se encolo ${draft.subject}: destinatario invalido.`);
    return null;
  }

  const queued = await queueKingestionEmail({
    dedupeKey,
    to: toRecipients,
    cc: draft.cc,
    subject: draft.subject,
    text: draft.text,
    html: draft.html,
    inReplyTo: draft.inReplyTo,
    references: draft.references,
    metadata: draft.metadata
  });
  summary.queuedEmails += queued.status === "sent" ? 0 : 1;
  return queued;
}

async function queueReplyEmailOnce(
  message: NonNullable<MailMessageForAutomation>,
  suffix: string,
  input: { to: string; body: string },
  summary: NativeAutomationSummary,
  context: { caseId?: string } = {}
) {
  const draft = await buildKingstonMailboxReplyDraft(message.uid, {
    to: input.to,
    body: input.body
  });
  return queueEmailOnce(
    buildEmailDedupeKey("mail-reply", [message.messageId || `uid-${message.uid}`, suffix, input.to]),
    {
      ...draft,
      metadata: {
        source: "mail-reply",
        mailboxUid: message.uid,
        caseId: context.caseId
      }
    },
    summary
  );
}

function inferAttachmentKind(name: string, subject: string, text: string): CaseAttachmentInput["kind"] {
  const normalized = normalizeToken(`${name} ${subject} ${text}`);
  if (normalized.includes("guia") || normalized.includes("tracking")) return "guide";
  if (normalized.includes("formulario") || normalized.includes("form")) return "form";
  if (
    normalized.includes("comprobante") ||
    normalized.includes("pago") ||
    normalized.includes("reintegro") ||
    normalized.includes("transferencia") ||
    normalized.includes("deposito")
  ) {
    return "proof";
  }
  if (/\.(png|jpe?g|webp|heic|gif)$/i.test(name)) return "photo";
  if (/\.(eml|msg)$/i.test(name)) return "mail";
  return "proof";
}

async function buildMailAttachments(
  message: NonNullable<MailMessageForAutomation>,
  caseId: string,
  summary: NativeAutomationSummary
): Promise<CaseAttachmentInput[]> {
  const attachments: CaseAttachmentInput[] = [];

  for (const attachment of message.attachments.filter((item) => item.name && item.size > 0).slice(0, 8)) {
    const sizeLabel =
      attachment.size < 1024 * 1024
        ? `${Math.max(1, Math.round(attachment.size / 1024))} KB`
        : `${(attachment.size / 1024 / 1024).toFixed(1)} MB`;

    try {
      const content = await getKingstonMailboxAttachment(message.uid, attachment.index);
      if (!content) {
        throw new Error(`No pude descargar ${attachment.name} desde el correo.`);
      }

      const stored = await saveKingestionAttachmentBlob({
        caseId,
        name: content.name || attachment.name,
        mimeType: content.mimeType || attachment.mimeType,
        content: content.content
      });

      attachments.push({
        name: content.name || attachment.name,
        kind: inferAttachmentKind(content.name || attachment.name, message.subject, message.text),
        sizeLabel,
        mimeType: content.mimeType || attachment.mimeType,
        previewUrl: stored.previewUrl
      });
    } catch (error) {
      summary.errors.push(
        error instanceof Error
          ? error.message
          : `No pude guardar internamente el adjunto ${attachment.name}.`
      );
      attachments.push({
        name: attachment.name,
        kind: inferAttachmentKind(attachment.name, message.subject, message.text),
        sizeLabel,
        mimeType: attachment.mimeType,
        previewUrl: `/api/mail/messages/${message.uid}/attachments/${attachment.index}`
      });
    }
  }

  return attachments;
}

function buildCreateCaseInput(parsed: ParsedKingstonMail, message: NonNullable<MailMessageForAutomation>): CreateCaseInput {
  const zone = inferZone(parsed.city, parsed.province);
  const deliveryMode = zone === "Capital / AMBA" ? "Pickup" : "Dispatch";

  return {
    kingstonNumber: parsed.kingstonNumber,
    clientName: parsed.contactName,
    contactName: parsed.contactName,
    contactEmail: parsed.contactEmail || message.fromEmail,
    contactPhone: parsed.contactPhone,
    owner: "Sin asignar",
    externalStatus: "Informado",
    zone,
    deliveryMode,
    priority: "Medium",
    address: parsed.address,
    province: parsed.province,
    city: parsed.city,
    sku: parsed.failedSku || parsed.replacementSku || "SKU pendiente",
    replacementSku: parsed.replacementSku,
    quantity: parsed.quantity,
    productDescription: parsed.replacementSku
      ? `Reemplazo Kingston ${parsed.replacementSku}`
      : `Producto Kingston ${parsed.failedSku || "pendiente"}`,
    failureDescription: parsed.notes,
    nextAction: getNextActionCopy("Informado"),
    observations: [
      `Caso creado automaticamente desde correo UID ${message.uid}.`,
      parsed.postalCode ? `Codigo postal: ${parsed.postalCode}.` : "",
      parsed.missingFields.length > 0 ? `Faltantes detectados: ${parsed.missingFields.join(", ")}.` : ""
    ]
      .filter(Boolean)
      .join(" "),
    origin: "Kingston email",
    attachments: []
  };
}

function buildKingstonAcknowledgement(createdCase: KingstonCase) {
  return [
    "Hola,",
    "",
    `Recibimos la autorizacion de Kingston y el caso quedo registrado en Kingestion como ${createdCase.internalNumber}.`,
    `Caso Kingston: ${createdCase.kingstonNumber}.`,
    "",
    "ANYX ya inicio el seguimiento operativo correspondiente.",
    "",
    "Saludos,",
    "Equipo ANYX"
  ].join("\n");
}

function buildCustomerNewCaseEmail(createdCase: KingstonCase) {
  return {
    subject: `RMA Kingston ${createdCase.kingstonNumber} recibido`,
    text: [
      `Hola ${createdCase.contactName},`,
      "",
      "Recibimos la autorizacion de garantia/RMA de Kingston y ya abrimos el seguimiento en ANYX.",
      `Numero interno: ${createdCase.internalNumber}.`,
      `Producto fallado: ${createdCase.sku}.`,
      createdCase.replacementSku ? `Reemplazo previsto: ${createdCase.replacementSku}.` : "",
      "",
      "Te vamos a contactar con el proximo paso segun corresponda a tu zona y disponibilidad del reemplazo.",
      "",
      "Saludos,",
      "Equipo ANYX"
    ]
      .filter(Boolean)
      .join("\n")
  };
}

function buildMissingInfoEmail(parsed: ParsedKingstonMail) {
  return [
    "Hola,",
    "",
    "Recibimos la autorizacion de Kingston, pero para completar el seguimiento necesitamos confirmar estos datos:",
    parsed.missingFields.map((field) => `- ${field}`).join("\n"),
    "",
    `Caso Kingston detectado: ${parsed.kingstonNumber || "pendiente de confirmar"}.`,
    "",
    "Saludos,",
    "Equipo ANYX"
  ].join("\n");
}

function buildExistingCaseReply(entry: KingstonCase) {
  if (entry.externalStatus === "OV creada") {
    return null;
  }

  const base = [`Hola ${entry.contactName},`, "", `Tu caso ${entry.internalNumber} esta en estado: ${entry.externalStatus}.`];

  switch (entry.externalStatus) {
    case "Informado":
      base.push("Estamos revisando la autorizacion y validando el proximo paso operativo.");
      break;
    case "Caso recibido":
      base.push("ANYX recibio el caso y te vamos a informar cuando puedas acercarte a realizar el cambio.");
      break;
    case "Aviso de envio":
      base.push("Estamos esperando la recepcion del producto fallado o el comprobante de envio.");
      break;
    case "Producto recepcionado y en preparacion":
      base.push("ANYX ya recibio el producto fallado y esta validando stock, reintegro y continuidad del caso.");
      break;
    case "Pedido Kingston":
      base.push("El reemplazo fue solicitado a Kingston y estamos esperando confirmacion o arribo.");
      break;
    case "En stock":
      base.push("Compras confirmo disponibilidad del reemplazo y el caso vuelve al flujo operativo para continuar.");
      break;
    case "Pendiente de recibirlo":
      base.push("Estamos esperando la confirmacion de remitir para avanzar con deposito y etiquetado.");
      break;
    case "Producto enviado":
      base.push(
        entry.logistics.guideNumber
          ? `El producto fue despachado. Numero de guia: ${entry.logistics.guideNumber}.`
          : "El producto fue despachado y la guia se informara cuando quede disponible."
      );
      break;
    case "Producto listo para retiro":
      base.push("El reemplazo esta listo para retiro en ANYX.");
      break;
    case "Realizado":
      base.push("El cambio fue completado correctamente y el RMA quedo finalizado.");
      break;
    case "Vencido":
      base.push("El caso quedo vencido por falta de respuesta o accion pendiente.");
      break;
    case "Cerrado":
      base.push("El caso se encuentra cerrado administrativamente.");
      break;
    default:
      base.push(entry.nextAction);
      break;
  }

  base.push("", "Saludos,", "Equipo ANYX");
  return {
    subject: `Estado RMA Kingston ${entry.kingstonNumber}`,
    text: base.join("\n")
  };
}

function envEmail(name: string) {
  const value = process.env[name]?.trim() ?? "";
  return isValidEmail(value) ? value : "";
}

function hasUsefulReimbursementAttachment(entry: KingstonCase) {
  return entry.attachments.some((attachment) => attachment.kind === "proof" || attachment.kind === "photo");
}

function inferReimbursementMissingFields(entry: KingstonCase) {
  const missingFields: string[] = [];
  const banking = entry.banking;

  if (!entry.contactEmail || !isValidEmail(entry.contactEmail)) {
    missingFields.push("correo de contacto valido");
  }

  if (!entry.contactName?.trim()) {
    missingFields.push("nombre y apellido del titular/contacto");
  }

  if (!banking?.accountHolder?.trim()) {
    missingFields.push("titular de la cuenta bancaria");
  }

  if (!banking?.cuit?.trim()) {
    missingFields.push("CUIT/CUIL del titular de la cuenta");
  }

  if (!banking?.bankName?.trim()) {
    missingFields.push("banco");
  }

  if (!banking?.cbu?.trim() && !banking?.alias?.trim()) {
    missingFields.push("CBU o alias bancario");
  }

  if (!hasUsefulReimbursementAttachment(entry)) {
    missingFields.push("comprobante necesario para validar el reintegro");
  }

  return missingFields;
}

function uniqueMissingFields(fields: string[]) {
  const seen = new Set<string>();
  return fields
    .map((field) => field.trim())
    .filter(Boolean)
    .filter((field) => {
      const key = normalizeToken(field);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function resolveReimbursementCcEmail() {
  const configured = envEmail("KINGESTION_REIMBURSEMENT_CC_EMAIL");
  if (configured) return configured;

  const owners = await listAutomationOwners().catch(() => []);
  const debora = owners.find((owner) => normalizeToken(owner.name).includes("debora") && isValidEmail(owner.email));
  if (debora) return debora.email;

  return owners.find((owner) => owner.team === "PAYMENTS" && isValidEmail(owner.email))?.email ?? "";
}

function buildReimbursementCompletedDraft(entry: KingstonCase) {
  return {
    to: entry.contactEmail,
    subject: `Reintegro realizado - RMA Kingston ${entry.kingstonNumber}`,
    text: [
      `Hola ${entry.contactName},`,
      "",
      `Te confirmamos que el reintegro correspondiente al caso ${entry.internalNumber} ya fue realizado.`,
      "Si necesitás validar algún dato adicional, podés responder por esta misma vía.",
      "",
      "Saludos,",
      "Equipo ANYX"
    ].join("\n")
  };
}

function buildReimbursementMissingDataDraft(entry: KingstonCase, missingFields: string[], cc?: string) {
  const fields = missingFields.length > 0 ? missingFields : ["confirmacion de los datos bancarios para reintegro"];

  return {
    to: entry.contactEmail,
    cc,
    subject: `Datos faltantes para reintegro - RMA Kingston ${entry.kingstonNumber}`,
    text: [
      `Hola ${entry.contactName},`,
      "",
      `Para poder realizar el reintegro del caso ${entry.internalNumber}, necesitamos que nos compartas o confirmes estos datos:`,
      fields.map((field) => `- ${field}`).join("\n"),
      "",
      "Podés responder este mismo correo con la información solicitada.",
      "",
      "Saludos,",
      "Equipo ANYX"
    ].join("\n")
  };
}

function buildStatusNotificationDrafts(entry: KingstonCase) {
  const customerTo = isValidEmail(entry.contactEmail) ? entry.contactEmail : "";
  const purchasingEmail = envEmail("KINGESTION_PURCHASING_EMAIL");
  const techEmail = envEmail("KINGESTION_TECH_EMAIL");
  const kingstonRequestEmail = envEmail("KINGESTION_KINGSTON_REQUEST_EMAIL");
  const pickupAddress = process.env.KINGESTION_PICKUP_ADDRESS?.trim() || "ANYX";
  const customerFormUrl = process.env.KINGESTION_CUSTOMER_FORM_URL?.trim();
  const drafts: Array<{ to: string; subject: string; text: string }> = [];

  if (entry.externalStatus === "OV creada") {
    if (purchasingEmail) {
      drafts.push({
        to: purchasingEmail,
        subject: `OV creada para RMA Kingston ${entry.kingstonNumber}`,
        text: [
          "Compras,",
          "",
          `El caso ${entry.internalNumber} quedo en OV creada y requiere definicion de abastecimiento.`,
          `Cliente: ${entry.clientName}.`,
          `SKU fallado: ${entry.sku}.`,
          entry.replacementSku ? `SKU reemplazo: ${entry.replacementSku}.` : "",
          "",
          "No se envio correo al cliente porque OV creada es un estado interno."
        ]
          .filter(Boolean)
          .join("\n")
      });
    }
    return drafts;
  }

  if (entry.externalStatus === "Liberar mercaderia" && purchasingEmail) {
    drafts.push({
      to: purchasingEmail,
      subject: `Liberar mercaderia - ${entry.internalNumber}`,
      text: `Compras, el caso ${entry.internalNumber} requiere liberar mercaderia para continuar el RMA Kingston ${entry.kingstonNumber}.`
    });
  }

  if (entry.externalStatus === "Pedido Kingston" && kingstonRequestEmail) {
    drafts.push({
      to: kingstonRequestEmail,
      subject: `Pedido Kingston requerido - ${entry.internalNumber}`,
      text: [
        "Se requiere consolidar pedido a Kingston.",
        "",
        `Caso: ${entry.internalNumber}`,
        `Caso Kingston: ${entry.kingstonNumber}`,
        `Cliente: ${entry.clientName}`,
        `SKU fallado: ${entry.sku}`,
        entry.replacementSku ? `SKU reemplazo: ${entry.replacementSku}` : "",
        `Cantidad: ${entry.quantity}`
      ]
        .filter(Boolean)
        .join("\n")
    });
  }

  if (entry.externalStatus === "Pedido deposito y etiquetado" && techEmail) {
    drafts.push({
      to: techEmail,
      subject: `Catalogacion y etiquetado RMA - ${entry.internalNumber}`,
      text: `Servicio tecnico, el caso ${entry.internalNumber} requiere cambio de deposito y etiquetado del producto fallado.`
    });
  }

  if (!customerTo) {
    return drafts;
  }

  switch (entry.externalStatus) {
    case "Caso recibido":
      drafts.push({
        to: customerTo,
        subject: `Caso recibido - RMA Kingston ${entry.kingstonNumber}`,
        text: [
          `Hola ${entry.contactName},`,
          "",
          `ANYX recibio el caso ${entry.internalNumber} correspondiente al RMA Kingston ${entry.kingstonNumber}.`,
          "Te vamos a informar por esta misma via cuando puedas acercarte a realizar el cambio.",
          "",
          "Saludos,",
          "Equipo ANYX"
        ].join("\n")
      });
      break;
    case "Aviso de envio":
      drafts.push({
        to: customerTo,
        subject: `Instrucciones de envio RMA Kingston ${entry.kingstonNumber}`,
        text: [
          `Hola ${entry.contactName},`,
          "",
          "Para avanzar con tu RMA Kingston, necesitamos que nos envies el producto fallado a ANYX y compartas el comprobante de envio por esta misma via.",
          customerFormUrl ? `Formulario de datos: ${customerFormUrl}` : "",
          "",
          "Saludos,",
          "Equipo ANYX"
        ]
          .filter(Boolean)
          .join("\n")
      });
      break;
    case "Producto recepcionado y en preparacion":
      drafts.push({
        to: customerTo,
        subject: `Producto recibido - RMA Kingston ${entry.kingstonNumber}`,
        text: `Hola ${entry.contactName},\n\nConfirmamos que ANYX recibio el producto fallado del caso ${entry.internalNumber}. Estamos validando disponibilidad y continuidad del reemplazo.\n\nSaludos,\nEquipo ANYX`
      });
      break;
    case "Pedido Kingston":
      drafts.push({
        to: customerTo,
        subject: `Pedido a Kingston - RMA ${entry.kingstonNumber}`,
        text: `Hola ${entry.contactName},\n\nEl reemplazo de tu caso ${entry.internalNumber} fue solicitado a Kingston. Te vamos a avisar cuando tengamos confirmacion o arribo.\n\nSaludos,\nEquipo ANYX`
      });
      break;
    case "Producto enviado":
      drafts.push({
        to: customerTo,
        subject: `Producto enviado - RMA ${entry.kingstonNumber}`,
        text: [
          `Hola ${entry.contactName},`,
          "",
          `El reemplazo del caso ${entry.internalNumber} fue despachado.`,
          entry.logistics.transporter ? `Transportista: ${entry.logistics.transporter}.` : "",
          entry.logistics.guideNumber ? `Numero de guia: ${entry.logistics.guideNumber}.` : "La guia se informara cuando quede disponible.",
          entry.logistics.trackingUrl ? `Tracking: ${entry.logistics.trackingUrl}` : "",
          "",
          "Saludos,",
          "Equipo ANYX"
        ]
          .filter(Boolean)
          .join("\n")
      });
      break;
    case "Producto listo para retiro":
      drafts.push({
        to: customerTo,
        subject: `Producto listo para retiro - RMA ${entry.kingstonNumber}`,
        text: `Hola ${entry.contactName},\n\nEl reemplazo del caso ${entry.internalNumber} ya esta listo para retiro en ${pickupAddress}.\n\nSaludos,\nEquipo ANYX`
      });
      break;
    case "Realizado":
      drafts.push({
        to: customerTo,
        subject: `RMA Kingston finalizado - ${entry.kingstonNumber}`,
        text: `Hola ${entry.contactName},\n\nConfirmamos que el cambio del caso ${entry.internalNumber} fue completado correctamente.\n\nSaludos,\nEquipo ANYX`
      });
      break;
    case "Vencido":
      drafts.push({
        to: customerTo,
        subject: `RMA Kingston vencido - ${entry.kingstonNumber}`,
        text: `Hola ${entry.contactName},\n\nEl caso ${entry.internalNumber} quedo vencido por falta de respuesta o accion pendiente. Si necesitas continuar, debera gestionarse una nueva solicitud.\n\nSaludos,\nEquipo ANYX`
      });
      break;
    case "Cerrado":
      drafts.push({
        to: customerTo,
        subject: `RMA Kingston cerrado - ${entry.kingstonNumber}`,
        text: `Hola ${entry.contactName},\n\nEl caso ${entry.internalNumber} se encuentra cerrado administrativamente.\n\nSaludos,\nEquipo ANYX`
      });
      break;
    default:
      break;
  }

  return drafts;
}

async function sendDraftsOnce(
  state: NativeAutomationState,
  stateKey: string,
  drafts: Array<{ to: string; subject: string; text: string }>,
  summary: NativeAutomationSummary,
  context: { caseId?: string; dedupeParts?: Array<string | number | null | undefined> } = {}
) {
  if (state.processedStatusKeys.includes(stateKey)) {
    return;
  }

  let hasQueueFailure = false;
  for (const draft of drafts) {
    try {
      await queueEmailOnce(
        buildEmailDedupeKey("status", [...(context.dedupeParts ?? [stateKey]), draft.to, draft.subject]),
        {
          ...draft,
          metadata: {
            source: "status-notification",
            stateKey,
            caseId: context.caseId
          }
        },
        summary
      );
    } catch (error) {
      hasQueueFailure = true;
      summary.errors.push(error instanceof Error ? error.message : `No pude encolar ${draft.subject}.`);
    }
  }

  if (hasQueueFailure) {
    return;
  }

  state.processedStatusKeys = rememberKey(state.processedStatusKeys, stateKey);
  await saveNativeState(state);
}

async function processEmailOutbox(summary: NativeAutomationSummary) {
  const queuedEmails = await claimDueKingestionEmails(Number(process.env.KINGESTION_EMAIL_OUTBOX_LIMIT ?? 20));

  for (const queuedEmail of queuedEmails) {
    try {
      const result = await sendKingestionEmail({
        to: queuedEmail.to,
        cc: queuedEmail.cc,
        subject: queuedEmail.subject,
        text: queuedEmail.text,
        html: queuedEmail.html || undefined,
        inReplyTo: queuedEmail.inReplyTo,
        references: queuedEmail.references,
        messageId: queuedEmail.messageId
      });

      await markKingestionEmailSent({
        id: queuedEmail.id,
        providerMessageId: result.messageId
      });
      summary.sentEmails += 1;

      const caseId = typeof queuedEmail.metadata.caseId === "string" ? queuedEmail.metadata.caseId : null;
      await recordKingestionAutomationAudit({
        action: "automation-email-sent",
        entityType: caseId ? "case" : "session",
        entityId: caseId ?? queuedEmail.id,
        detail: `Correo enviado a ${queuedEmail.to.join(", ")}. Asunto: ${queuedEmail.subject}.`
      }).catch(() => undefined);

      const mailboxUid = queuedEmail.metadata.mailboxUid;
      if (typeof mailboxUid === "string" || typeof mailboxUid === "number") {
        await markKingstonMailboxMessageAnswered(mailboxUid).catch(() => undefined);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : `No pude enviar ${queuedEmail.subject}.`;
      const failedEmail = await markKingestionEmailFailed({
        id: queuedEmail.id,
        error: message
      });
      const caseId = typeof queuedEmail.metadata.caseId === "string" ? queuedEmail.metadata.caseId : null;
      await recordKingestionAutomationAudit({
        action: failedEmail?.status === "failed" ? "automation-email-gave-up" : "automation-email-failed",
        entityType: caseId ? "case" : "session",
        entityId: caseId ?? queuedEmail.id,
        detail:
          failedEmail?.status === "failed"
            ? `Se agotaron los reintentos para enviar correo a ${queuedEmail.to.join(", ")}. Asunto: ${queuedEmail.subject}. Intentos: ${failedEmail.attempts}. Error: ${message}`
            : `No se pudo enviar correo a ${queuedEmail.to.join(", ")}. Asunto: ${queuedEmail.subject}. Error: ${message}`
      }).catch(() => undefined);
      summary.errors.push(message);
    }
  }
}

async function processMailbox(state: NativeAutomationState, summary: NativeAutomationSummary) {
  const mailbox = await listKingstonMailboxMessages(
    Number(process.env.KINGESTION_MAIL_AUTOMATION_LIMIT ?? DEFAULT_MAIL_LIMIT)
  );
  const mailboxAddress = getKingestionMailboxAddress().toLowerCase();
  const messages = [...mailbox.items].sort((left, right) => {
    const leftTime = left.date ? new Date(left.date).getTime() : 0;
    const rightTime = right.date ? new Date(right.date).getTime() : 0;
    return leftTime - rightTime || String(left.uid).localeCompare(String(right.uid));
  });

  for (const listItem of messages) {
    const uidKey = `mail-uid:${listItem.uid}`;
    const uidAlreadyProcessed = state.processedMailKeys.includes(uidKey);

    const message = await getKingstonMailboxMessage(listItem.uid);
    if (!message) {
      state.processedMailKeys = rememberKey(state.processedMailKeys, uidKey);
      summary.skippedMessages += 1;
      continue;
    }

    const messageIdKey = message.messageId ? `mail-message-id:${message.messageId}` : null;
    const messageAlreadyProcessed =
      uidAlreadyProcessed || Boolean(messageIdKey && state.processedMailKeys.includes(messageIdKey));

    const heuristicParsed = parseKingstonAuthorizationMail(message);
    const heuristicLikely = isLikelyKingstonMail(message, heuristicParsed);
    const standardAuthorizationMail = isStandardKingstonAuthorizationMail(message, heuristicParsed);
    const isMailboxReply =
      message.fromEmail.trim().toLowerCase() === mailboxAddress && /^re\s*:/i.test(message.subject.trim());

    if (isMailboxReply) {
      state.processedMailKeys = rememberKey(state.processedMailKeys, uidKey);
      if (messageIdKey) state.processedMailKeys = rememberKey(state.processedMailKeys, messageIdKey);
      summary.skippedMessages += 1;
      await saveNativeState(state);
      continue;
    }

    const shouldUseAi =
      !standardAuthorizationMail ||
      !heuristicLikely ||
      heuristicParsed.missingFields.length > 0 ||
      message.attachments.length > 0;
    const ai = shouldUseAi ? await interpretKingstonMailWithAi(message) : null;
    if (ai?.used) {
      summary.aiInterpretedMessages += 1;
    }

    const parsed = ai ? mergeParsedMailWithAi(heuristicParsed, ai) : heuristicParsed;
    const aiLikely =
      ai?.used === true &&
      ai.confidence >= 0.55 &&
      (ai.intent === "new_case" ||
        ai.intent === "case_update" ||
        ai.intent === "payment_proof" ||
        ai.intent === "shipping_proof" ||
        ai.intent === "status_question");

    if (!heuristicLikely && !aiLikely) {
      state.processedMailKeys = rememberKey(state.processedMailKeys, uidKey);
      summary.skippedMessages += 1;
      await saveNativeState(state);
      continue;
    }

    if (messageAlreadyProcessed) {
      if (!parsed.kingstonNumber) {
        continue;
      }

      const cases = await listAutomationCases({ includeArchived: true });
      const existingCase = findCaseByKingstonNumber(cases, parsed.kingstonNumber);
      if (existingCase) {
        continue;
      }

      await recordKingestionAutomationAudit({
        action: "automation-mail-reprocess",
        entityType: "session",
        entityId: `mail-uid-${message.uid}`,
        detail: `Se reintenta procesar un correo previamente marcado porque no existe caso para Kingston ${parsed.kingstonNumber}.`
      });
    }

    if (!parsed.kingstonNumber) {
      summary.reviewMessages += 1;
      await recordKingestionAutomationAudit({
        action: "automation-mail-review-needed",
        entityType: "session",
        entityId: `mail-uid-${message.uid}`,
        detail: `Correo ${message.uid} parece relevante, pero no tiene numero Kingston confiable. Asunto: ${message.subject}.`
      });
      state.processedMailKeys = rememberKey(state.processedMailKeys, uidKey);
      if (messageIdKey) state.processedMailKeys = rememberKey(state.processedMailKeys, messageIdKey);
      await saveNativeState(state);
      continue;
    }

    const cases = await listAutomationCases({ includeArchived: true });
    const existingCase = findCaseByKingstonNumber(cases, parsed.kingstonNumber);

    try {
      if (!existingCase) {
        const createdCase = await createAutomationCase(buildCreateCaseInput(parsed, message));
        if (!createdCase) {
          throw new Error("No pude confirmar el alta del caso creado.");
        }

        const attachments = await buildMailAttachments(message, createdCase.id, summary);
        for (const attachment of attachments) {
          await patchAutomationCase(createdCase.id, { attachment });
        }

        await patchAutomationCase(createdCase.id, {
          comment: {
            internal: true,
            body: [
              `Correo recibido en bandeja Kingston desde ${message.fromEmail || message.fromName}.`,
              `Asunto: ${message.subject}.`,
              message.text.slice(0, 900)
            ].join("\n\n")
          }
        });

        summary.createdCases += 1;

        await recordKingestionAutomationAudit({
          action: "automation-mail-processed",
          entityType: "case",
          entityId: createdCase.id,
          detail: `Correo UID ${message.uid} procesado como nuevo caso Kingston ${createdCase.kingstonNumber}.`
        }).catch(() => undefined);

        if (message.fromEmail && isValidEmail(message.fromEmail) && message.fromEmail.trim().toLowerCase() !== mailboxAddress) {
          await queueReplyEmailOnce(
            message,
            parsed.missingFields.length > 0 ? "missing-info" : "acknowledgement",
            {
              to: message.fromEmail,
              body:
                parsed.missingFields.length > 0
                  ? buildMissingInfoEmail(parsed)
                  : buildKingstonAcknowledgement(createdCase)
            },
            summary,
            { caseId: createdCase.id }
          );
        }

        const trustedAuthorizationSender = isTrustedAuthorizationSender(message.fromEmail);
        const canSendCustomerNewCaseEmail =
          isSafeCustomerEmail(createdCase.contactEmail) &&
          trustedAuthorizationSender &&
          parsed.missingFields.length === 0 &&
          (standardAuthorizationMail || (ai?.used === true && ai.confidence >= 0.7 && ai.safeToEmailCustomer));

        if (canSendCustomerNewCaseEmail) {
          const customerEmail = buildCustomerNewCaseEmail(createdCase);
          await queueEmailOnce(
            buildEmailDedupeKey("mail-customer-new-case", [createdCase.id, message.messageId || `uid-${message.uid}`]),
            {
              to: createdCase.contactEmail,
              subject: customerEmail.subject,
              text: customerEmail.text,
              metadata: {
                source: "new-case-customer",
                caseId: createdCase.id,
                mailboxUid: message.uid
              }
            },
            summary
          );
        } else {
          summary.reviewMessages += 1;
          await recordKingestionAutomationAudit({
            action: "automation-customer-email-held",
            entityType: "case",
            entityId: createdCase.id,
            detail: `No se envio correo automatico al cliente del caso ${createdCase.internalNumber} por datos insuficientes, remitente no confiable o baja confianza.`
          });
        }

        state.processedMailKeys = rememberKey(state.processedMailKeys, uidKey);
        if (messageIdKey) state.processedMailKeys = rememberKey(state.processedMailKeys, messageIdKey);
        await saveNativeState(state);
      } else {
        await patchAutomationCase(existingCase.id, {
          comment: {
            internal: true,
            body: [
              `Correo recibido en bandeja Kingston desde ${message.fromEmail || message.fromName}.`,
              `Asunto: ${message.subject}.`,
              message.text.slice(0, 900)
            ].join("\n\n")
          }
        });

        const attachments = await buildMailAttachments(message, existingCase.id, summary);
        for (const attachment of attachments) {
          await patchAutomationCase(existingCase.id, { attachment });
        }

        const refreshedCase = (await getAutomationCase(existingCase.id)) ?? existingCase;
        summary.updatedCases += 1;

        await recordKingestionAutomationAudit({
          action: "automation-mail-processed",
          entityType: "case",
          entityId: refreshedCase.id,
          detail: `Correo UID ${message.uid} procesado como seguimiento del caso Kingston ${refreshedCase.kingstonNumber}.`
        }).catch(() => undefined);

        const senderIsCustomer =
          message.fromEmail.trim().toLowerCase() === refreshedCase.contactEmail.trim().toLowerCase();
        const replyDraft = senderIsCustomer ? buildExistingCaseReply(refreshedCase) : null;
        if (replyDraft && isValidEmail(message.fromEmail)) {
          await queueReplyEmailOnce(
            message,
            `existing-${refreshedCase.id}-${refreshedCase.externalStatus}`,
            {
              to: message.fromEmail,
              body: replyDraft.text
            },
            summary,
            { caseId: existingCase.id }
          );
        }

        state.processedMailKeys = rememberKey(state.processedMailKeys, uidKey);
        if (messageIdKey) state.processedMailKeys = rememberKey(state.processedMailKeys, messageIdKey);
        await saveNativeState(state);
      }

      summary.processedMessages += 1;
    } catch (error) {
      summary.errors.push(error instanceof Error ? error.message : `No pude procesar UID ${message.uid}.`);
    }
  }
}

async function initializeStatusBackfill(state: NativeAutomationState) {
  if (state.statusBackfillInitializedAt) return;
  const activities = await getAutomationActivity({
    action: "case-status-updated",
    entityType: "case",
    limit: 500
  });
  state.processedStatusKeys = [
    ...activities.map((activity: { id: string }) => `status-audit:${activity.id}`),
    ...state.processedStatusKeys
  ].slice(0, MAX_PROCESSED_KEYS);
  state.statusBackfillInitializedAt = new Date().toISOString();
  await saveNativeState(state);
}

async function processPendingStatusNotifications(state: NativeAutomationState, summary: NativeAutomationSummary) {
  await initializeStatusBackfill(state);
  const activities = await getAutomationActivity({
    action: "case-status-updated",
    entityType: "case",
    limit: 80
  });

  for (const activity of activities.reverse()) {
    const key = `status-audit:${activity.id}`;
    if (state.processedStatusKeys.includes(key)) {
      continue;
    }

    const entry = await getAutomationCase(activity.entityId);
    if (!entry) {
      state.processedStatusKeys = rememberKey(state.processedStatusKeys, key);
      continue;
    }

    const drafts = buildStatusNotificationDrafts(entry);
    await sendDraftsOnce(state, key, drafts, summary, {
      caseId: entry.id,
      dedupeParts: [entry.id, entry.externalStatus, entry.updatedAt]
    });

    if (drafts.length > 0) {
      await recordKingestionAutomationAudit({
        action: "automation-status-email-sent",
        entityType: "case",
        entityId: entry.id,
        detail: `Se encolaron ${drafts.length} aviso(s) por estado ${entry.externalStatus} del caso ${entry.internalNumber}.`
      });
    }
  }
}

async function processSlaOverdueAlerts(state: NativeAutomationState, summary: NativeAutomationSummary) {
  const cases = await listAutomationCases({ includeArchived: false });
  const now = Date.now();

  for (const entry of cases) {
    if (isClosedCaseStatus(entry.externalStatus)) {
      continue;
    }

    const dueAt = new Date(entry.slaDueAt).getTime();
    if (!Number.isFinite(dueAt) || dueAt > now) {
      continue;
    }

    const key = `sla-overdue:${entry.id}:${entry.slaDueAt}`;
    if (state.processedStatusKeys.includes(key)) {
      continue;
    }

    await recordKingestionAutomationAudit({
      action: "automation-sla-overdue",
      entityType: "case",
      entityId: entry.id,
      detail: `El caso ${entry.internalNumber} supero su SLA y requiere revision manual antes de marcarlo como Vencido.`
    });
    state.processedStatusKeys = rememberKey(state.processedStatusKeys, key);
    summary.reviewMessages += 1;
  }
}

export async function sendCaseStatusNotificationFromKingestion(caseId: string, statusHint?: ExternalStatus) {
  const state = await loadNativeState();
  const summary = buildEmptySummary();
  const entry = await getAutomationCase(caseId);
  if (!entry) return summary;

  const key = `status-case:${entry.id}:${statusHint ?? entry.externalStatus}:${entry.updatedAt}`;
  const drafts = buildStatusNotificationDrafts(entry);
  await sendDraftsOnce(state, key, drafts, summary, {
    caseId: entry.id,
    dedupeParts: [entry.id, entry.externalStatus, entry.updatedAt]
  });

  if (drafts.length > 0) {
    await recordKingestionAutomationAudit({
      action: "automation-status-email-sent",
      entityType: "case",
      entityId: entry.id,
      detail: `Se encolaron ${drafts.length} aviso(s) por estado ${entry.externalStatus} del caso ${entry.internalNumber}.`
    });
  }

  await processEmailOutbox(summary).catch((error) => {
    summary.errors.push(error instanceof Error ? error.message : "No pude procesar la cola de correos.");
  });

  return summary;
}

export async function sendReimbursementCompletedNotificationFromKingestion(caseId: string) {
  const summary = buildEmptySummary();
  const entry = await getAutomationCase(caseId);
  if (!entry) return summary;

  if (!isValidEmail(entry.contactEmail)) {
    summary.errors.push(`No se envio aviso de reintegro de ${entry.internalNumber}: correo de cliente invalido.`);
    return summary;
  }

  const draft = buildReimbursementCompletedDraft(entry);
  await queueEmailOnce(
    buildEmailDedupeKey("reimbursement-completed", [entry.id]),
    {
      ...draft,
      metadata: {
        source: "reimbursement-completed",
        caseId: entry.id
      }
    },
    summary
  );

  await recordKingestionAutomationAudit({
    action: "automation-reimbursement-completed-email-sent",
    entityType: "case",
    entityId: entry.id,
    detail: `Se encolo aviso de reintegro completado para ${entry.internalNumber}.`
  }).catch(() => undefined);

  await processEmailOutbox(summary).catch((error) => {
    summary.errors.push(error instanceof Error ? error.message : "No pude procesar la cola de correos.");
  });

  return summary;
}

export async function sendReimbursementMissingDataRequestFromKingestion(caseId: string) {
  const summary = buildEmptySummary();
  const entry = await getAutomationCase(caseId);
  if (!entry) return summary;

  if (!isValidEmail(entry.contactEmail)) {
    summary.errors.push(`No se solicito datos de reintegro de ${entry.internalNumber}: correo de cliente invalido.`);
    return summary;
  }

  const baselineMissingFields = inferReimbursementMissingFields(entry);
  const ai = await interpretReimbursementMissingFieldsWithAi(entry, baselineMissingFields);
  const missingFields = uniqueMissingFields(ai.missingFields.length > 0 ? ai.missingFields : baselineMissingFields);
  const cc = await resolveReimbursementCcEmail();
  const draft = buildReimbursementMissingDataDraft(entry, missingFields, cc || undefined);

  await queueEmailOnce(
    buildEmailDedupeKey("reimbursement-missing-data", [entry.id]),
    {
      ...draft,
      metadata: {
        source: "reimbursement-missing-data",
        caseId: entry.id,
        missingFields,
        aiUsed: ai.used,
        aiReason: ai.reason
      }
    },
    summary
  );

  await recordKingestionAutomationAudit({
    action: "automation-reimbursement-missing-data-email-sent",
    entityType: "case",
    entityId: entry.id,
    detail: `Se encolo solicitud de datos faltantes para reintegro de ${entry.internalNumber}. Campos: ${missingFields.join(", ") || "revision general"}.`
  }).catch(() => undefined);

  await processEmailOutbox(summary).catch((error) => {
    summary.errors.push(error instanceof Error ? error.message : "No pude procesar la cola de correos.");
  });

  return summary;
}

export async function runKingestionNativeAutomation(args: {
  actor?: OwnerDirectoryEntry | null;
  source?: "manual" | "cron" | "api";
} = {}): Promise<AutomationTriggerResult> {
  const control = await getKingestionAutomationControlState();
  const triggeredAt = new Date().toISOString();
  const mode = process.env.KINGESTION_AUTOMATION_PILOT_MODE === "false" ? "production" : "pilot";
  const actor = args.actor ?? createAutomationActor();

  if (control.paused) {
    return {
      ok: true,
      queued: false,
      paused: true,
      triggeredAt,
      mode,
      target: "Kingestion",
      message: "La automatizacion nativa esta pausada manualmente en Kingestion.",
      processedMessages: 0,
      createdCases: 0,
      updatedCases: 0,
      sentEmails: 0,
      queuedEmails: 0,
      aiInterpretedMessages: 0,
      reviewMessages: 0,
      skippedMessages: 0,
      errors: []
    };
  }

  return withKingestionAdvisoryLock<AutomationTriggerResult>(
    "KINGESTION_NATIVE_AUTOMATION",
    async () => ({
      ok: true,
      queued: false,
      paused: false,
      triggeredAt,
      mode,
      target: "Kingestion",
      message: "Ya hay una corrida de automatizacion en curso. Se omite esta solicitud para evitar duplicados.",
      processedMessages: 0,
      createdCases: 0,
      updatedCases: 0,
      sentEmails: 0,
      queuedEmails: 0,
      aiInterpretedMessages: 0,
      reviewMessages: 0,
      skippedMessages: 0,
      errors: []
    }),
    async () => {
      const state = await loadNativeState();
      const summary = buildEmptySummary();

      try {
        await processMailbox(state, summary);
        await processPendingStatusNotifications(state, summary);
        await processSlaOverdueAlerts(state, summary);
      } catch (error) {
        summary.errors.push(error instanceof Error ? error.message : "Error general de automatizacion nativa.");
      }

      try {
        await processEmailOutbox(summary);
      } catch (error) {
        summary.errors.push(error instanceof Error ? error.message : "Error procesando la cola de correos.");
      }

      const nextState: NativeAutomationState = {
        ...state,
        lastRunAt: triggeredAt,
        lastSummary: summary
      };
      await saveNativeState(nextState);

      const hasActivity =
        summary.processedMessages > 0 ||
        summary.createdCases > 0 ||
        summary.updatedCases > 0 ||
        summary.sentEmails > 0 ||
        summary.queuedEmails > 0 ||
        summary.aiInterpretedMessages > 0 ||
        summary.reviewMessages > 0 ||
        summary.errors.length > 0 ||
        args.source === "manual";

      if (hasActivity) {
        await recordKingestionAutomationAudit({
          actor,
          action: "automation-native-run",
          entityId: "kingestion-native-automation",
          detail: `Corrida ${args.source ?? "manual"}: ${summary.processedMessages} correo(s), ${summary.createdCases} alta(s), ${summary.updatedCases} actualizacion(es), ${summary.queuedEmails} mail(s) en cola, ${summary.sentEmails} mail(s) enviados, ${summary.aiInterpretedMessages} interpretado(s) con IA, ${summary.reviewMessages} revision(es), ${summary.errors.length} error(es).`
        });
      }

      return {
        ok: summary.errors.length === 0,
        queued: true,
        paused: false,
        triggeredAt,
        mode,
        target: "Kingestion",
        message:
          summary.errors.length === 0
            ? "La automatizacion nativa de Kingestion se ejecuto correctamente."
            : "La automatizacion nativa termino con observaciones. Revisa el detalle de errores.",
        processedMessages: summary.processedMessages,
        createdCases: summary.createdCases,
        updatedCases: summary.updatedCases,
        sentEmails: summary.sentEmails,
        queuedEmails: summary.queuedEmails,
        aiInterpretedMessages: summary.aiInterpretedMessages,
        reviewMessages: summary.reviewMessages,
        skippedMessages: summary.skippedMessages,
        errors: summary.errors
      };
    }
  );
}
