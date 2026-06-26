import "server-only";

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";

type AddressLike = {
  name?: string;
  address?: string;
};

type DateLike = Date | string;

type MailProvider = "imap-smtp" | "microsoft-graph";

type MailConfig = {
  provider: MailProvider;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  user: string;
  password: string;
  fromEmail: string;
  folder: string;
};

type MicrosoftGraphConfig = {
  provider: "microsoft-graph";
  tenantId: string;
  clientId: string;
  clientSecret: string;
  mailbox: string;
  fromEmail: string;
  folder: string;
};

export type KingstonMailListItem = {
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

export type KingstonMailAttachment = {
  index: number;
  name: string;
  mimeType: string;
  size: number;
};

export type KingstonMailMessage = KingstonMailListItem & {
  messageId: string | null;
  to: string[];
  cc: string[];
  replyTo: string[];
  text: string;
  html: string | null;
  attachments: KingstonMailAttachment[];
};

export type KingstonMailReplyInput = {
  to: string;
  cc?: string;
  body: string;
};

export type KingestionMailSendInput = {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  text: string;
  html?: string;
  inReplyTo?: string | null;
  references?: string[];
  messageId?: string;
};

function getEnv(name: string, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

function getNumberEnv(name: string, fallback: number) {
  const raw = getEnv(name);
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getBooleanEnv(name: string, fallback: boolean) {
  const raw = getEnv(name).toLowerCase();
  if (["1", "true", "yes", "si", "sí"].includes(raw)) return true;
  if (["0", "false", "no"].includes(raw)) return false;
  return fallback;
}

function getMailProvider(): MailProvider {
  const value = getEnv("KINGESTION_MAIL_PROVIDER", "imap-smtp").toLowerCase();
  return value === "microsoft-graph" ? "microsoft-graph" : "imap-smtp";
}

function getMailConfig(): MailConfig {
  const user = getEnv("KINGESTION_MAIL_USER");
  const password = getEnv("KINGESTION_MAIL_PASSWORD");

  if (!user || !password) {
    throw new Error("Falta configurar KINGESTION_MAIL_USER y KINGESTION_MAIL_PASSWORD.");
  }

  return {
    provider: "imap-smtp",
    imapHost: getEnv("KINGESTION_MAIL_IMAP_HOST", "imap.gmail.com"),
    imapPort: getNumberEnv("KINGESTION_MAIL_IMAP_PORT", 993),
    imapSecure: getBooleanEnv("KINGESTION_MAIL_IMAP_SECURE", true),
    smtpHost: getEnv("KINGESTION_MAIL_SMTP_HOST", "smtp.gmail.com"),
    smtpPort: getNumberEnv("KINGESTION_MAIL_SMTP_PORT", 465),
    smtpSecure: getBooleanEnv("KINGESTION_MAIL_SMTP_SECURE", true),
    user,
    password,
    fromEmail: getEnv("KINGESTION_MAIL_FROM", user),
    folder: getEnv("KINGESTION_MAIL_KINGSTON_FOLDER", "Casos kingston")
  };
}

function getMicrosoftGraphConfig(): MicrosoftGraphConfig {
  const tenantId = getEnv("KINGESTION_MS_TENANT_ID");
  const clientId = getEnv("KINGESTION_MS_CLIENT_ID");
  const clientSecret = getEnv("KINGESTION_MS_CLIENT_SECRET");
  const mailbox = getEnv("KINGESTION_MS_SHARED_MAILBOX") || getEnv("KINGESTION_MAIL_FROM");

  if (!tenantId || !clientId || !clientSecret || !mailbox) {
    throw new Error(
      "Falta configurar KINGESTION_MS_TENANT_ID, KINGESTION_MS_CLIENT_ID, KINGESTION_MS_CLIENT_SECRET y KINGESTION_MS_SHARED_MAILBOX."
    );
  }

  return {
    provider: "microsoft-graph",
    tenantId,
    clientId,
    clientSecret,
    mailbox,
    fromEmail: getEnv("KINGESTION_MAIL_FROM", mailbox),
    folder: getEnv("KINGESTION_MAIL_KINGSTON_FOLDER", "Casos kingston")
  };
}

function getActiveMailConfig() {
  return getMailProvider() === "microsoft-graph" ? getMicrosoftGraphConfig() : getMailConfig();
}

export function getKingestionMailboxAddress() {
  return getActiveMailConfig().fromEmail;
}

function createImapClient(config = getMailConfig()) {
  return new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: config.imapSecure,
    auth: {
      user: config.user,
      pass: config.password
    },
    logger: false
  });
}

type MicrosoftGraphTokenCache = {
  accessToken: string;
  expiresAt: number;
};

type GraphMessage = {
  id: string;
  subject?: string | null;
  receivedDateTime?: string | null;
  sentDateTime?: string | null;
  internetMessageId?: string | null;
  bodyPreview?: string | null;
  isRead?: boolean;
  hasAttachments?: boolean;
  size?: number | null;
  from?: {
    emailAddress?: {
      name?: string | null;
      address?: string | null;
    };
  } | null;
  sender?: {
    emailAddress?: {
      name?: string | null;
      address?: string | null;
    };
  } | null;
  body?: {
    contentType?: string | null;
    content?: string | null;
  } | null;
  toRecipients?: GraphRecipient[];
  ccRecipients?: GraphRecipient[];
  replyTo?: GraphRecipient[];
  attachments?: GraphAttachment[];
};

type GraphRecipient = {
  emailAddress?: {
    name?: string | null;
    address?: string | null;
  };
};

type GraphAttachment = {
  id: string;
  name?: string | null;
  contentType?: string | null;
  size?: number | null;
  isInline?: boolean;
  contentBytes?: string;
  "@odata.type"?: string;
};

type GraphFolder = {
  id: string;
  displayName?: string | null;
  totalItemCount?: number | null;
  childFolderCount?: number | null;
};

let graphTokenCache: MicrosoftGraphTokenCache | null = null;

function normalizeGraphMailbox(mailbox: string) {
  return encodeURIComponent(mailbox.trim());
}

function encodeGraphUid(messageId: string) {
  return `graph_${Buffer.from(messageId, "utf8").toString("base64url")}`;
}

function decodeGraphUid(uid: string) {
  if (!uid.startsWith("graph_")) return null;
  try {
    return Buffer.from(uid.slice("graph_".length), "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function normalizeMailboxUid(uid: string | number) {
  return String(uid).trim();
}

async function getMicrosoftGraphAccessToken(config = getMicrosoftGraphConfig()) {
  if (graphTokenCache && graphTokenCache.expiresAt > Date.now() + 60_000) {
    return graphTokenCache.accessToken;
  }

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default"
  });

  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    const errorText = await response.text();
    let microsoftError = errorText.trim();

    try {
      const parsed = JSON.parse(errorText) as { error?: string; error_description?: string };
      microsoftError = [parsed.error, parsed.error_description].filter(Boolean).join(": ");
    } catch {
      // Microsoft puede responder texto plano en algunos errores de proxy/red.
    }

    throw new Error(
      `Microsoft no entrego token OAuth (${response.status})${
        microsoftError ? `: ${microsoftError}` : "."
      }`
    );
  }

  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) {
    throw new Error("Microsoft no devolvio access_token.");
  }

  graphTokenCache = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(Number(payload.expires_in ?? 3600) - 120, 60) * 1000
  };

  return graphTokenCache.accessToken;
}

async function graphRequest<T>(
  config: MicrosoftGraphConfig,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = await getMicrosoftGraphAccessToken(config);
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers
    }
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? JSON.stringify((payload as { error?: unknown }).error)
        : text;
    throw new Error(`Microsoft Graph respondio ${response.status}: ${message}`);
  }

  return payload as T;
}

async function findMicrosoftGraphFolderId(config: MicrosoftGraphConfig) {
  const folderName = config.folder.trim();
  if (!folderName || folderName.toLowerCase() === "inbox" || folderName.toLowerCase() === "bandeja de entrada") {
    return {
      id: "inbox",
      displayName: "Inbox",
      count: 0
    };
  }

  const mailbox = normalizeGraphMailbox(config.mailbox);
  const queue: Array<{ path: string; depth: number }> = [
    {
      path: `/users/${mailbox}/mailFolders?$top=100&$select=id,displayName,totalItemCount,childFolderCount`,
      depth: 0
    }
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const response = await graphRequest<{ value?: GraphFolder[] }>(config, current.path);
    const folders = response.value ?? [];
    const match = folders.find((folder) => folder.displayName?.trim().toLowerCase() === folderName.toLowerCase());
    if (match) {
      return {
        id: match.id,
        displayName: match.displayName || folderName,
        count: match.totalItemCount ?? 0
      };
    }

    if (current.depth < 3) {
      folders
        .filter((folder) => (folder.childFolderCount ?? 0) > 0)
        .forEach((folder) => {
          queue.push({
            path: `/users/${mailbox}/mailFolders/${encodeURIComponent(folder.id)}/childFolders?$top=100&$select=id,displayName,totalItemCount,childFolderCount`,
            depth: current.depth + 1
          });
        });
    }
  }

  throw new Error(`No encontre la carpeta "${folderName}" en el buzon compartido ${config.mailbox}.`);
}

function graphEmailAddress(recipient?: GraphRecipient | null) {
  return normalizeAddress({
    name: recipient?.emailAddress?.name ?? undefined,
    address: recipient?.emailAddress?.address ?? undefined
  });
}

function graphRecipientsToStrings(recipients?: GraphRecipient[]) {
  return (recipients ?? [])
    .map((recipient) => {
      const normalized = graphEmailAddress(recipient);
      return normalized.email ? `${normalized.name} <${normalized.email}>` : normalized.name;
    })
    .filter(Boolean);
}

function graphAttachmentToListItem(attachment: GraphAttachment, index: number): KingstonMailAttachment {
  return {
    index,
    name: attachment.name || `adjunto-${index + 1}`,
    mimeType: attachment.contentType || "application/octet-stream",
    size: attachment.size ?? 0
  };
}

function graphMessageToListItem(message: GraphMessage): KingstonMailListItem {
  const from = graphEmailAddress(message.from ?? message.sender);
  const attachments = (message.attachments ?? []).filter((attachment) => !attachment.isInline);

  return {
    uid: encodeGraphUid(message.id),
    subject: message.subject?.trim() || "(Sin asunto)",
    fromName: from.name,
    fromEmail: from.email,
    date: message.receivedDateTime ?? message.sentDateTime ?? null,
    size: message.size ?? null,
    seen: message.isRead === true,
    answered: false,
    attachmentCount: message.hasAttachments ? Math.max(attachments.length, 1) : attachments.length
  };
}

async function listMicrosoftGraphMessages(limit = 50) {
  const config = getMicrosoftGraphConfig();
  const folder = await findMicrosoftGraphFolderId(config);
  const mailbox = normalizeGraphMailbox(config.mailbox);
  const query = new URLSearchParams({
    "$top": String(limit),
    "$orderby": "receivedDateTime desc",
    "$select":
      "id,subject,from,sender,receivedDateTime,sentDateTime,isRead,hasAttachments,bodyPreview,size,internetMessageId,toRecipients,ccRecipients,replyTo",
    "$expand": "attachments($select=id,name,contentType,size,isInline)"
  });
  const response = await graphRequest<{ value?: GraphMessage[] }>(
    config,
    `/users/${mailbox}/mailFolders/${encodeURIComponent(folder.id)}/messages?${query.toString()}`
  );

  return {
    folder: folder.displayName || config.folder,
    count: folder.count || response.value?.length || 0,
    items: (response.value ?? []).map(graphMessageToListItem).slice(0, limit)
  };
}

async function getMicrosoftGraphMessage(uid: string): Promise<KingstonMailMessage | null> {
  const messageId = decodeGraphUid(uid);
  if (!messageId) return null;

  const config = getMicrosoftGraphConfig();
  const mailbox = normalizeGraphMailbox(config.mailbox);
  const query = new URLSearchParams({
    "$select":
      "id,subject,from,sender,receivedDateTime,sentDateTime,isRead,hasAttachments,body,bodyPreview,size,internetMessageId,toRecipients,ccRecipients,replyTo",
    "$expand": "attachments($select=id,name,contentType,size,isInline)"
  });
  const message = await graphRequest<GraphMessage>(
    config,
    `/users/${mailbox}/messages/${encodeURIComponent(messageId)}?${query.toString()}`
  );
  const listItem = graphMessageToListItem(message);
  const html = message.body?.contentType?.toLowerCase() === "html" ? message.body.content ?? null : null;
  const text =
    message.body?.contentType?.toLowerCase() === "text"
      ? message.body.content?.trim() ?? ""
      : html
        ? decodeTextFromHtml(html)
        : message.bodyPreview?.trim() ?? "";

  return {
    ...listItem,
    messageId: message.internetMessageId ?? message.id,
    to: graphRecipientsToStrings(message.toRecipients),
    cc: graphRecipientsToStrings(message.ccRecipients),
    replyTo: graphRecipientsToStrings(message.replyTo),
    text,
    html,
    attachments: (message.attachments ?? [])
      .filter((attachment) => !attachment.isInline)
      .map(graphAttachmentToListItem)
  };
}

async function getMicrosoftGraphAttachment(uid: string, index: number) {
  const messageId = decodeGraphUid(uid);
  if (!messageId) return null;

  const config = getMicrosoftGraphConfig();
  const mailbox = normalizeGraphMailbox(config.mailbox);
  const attachments = await graphRequest<{ value?: GraphAttachment[] }>(
    config,
    `/users/${mailbox}/messages/${encodeURIComponent(messageId)}/attachments?$top=50&$select=id,name,contentType,size,isInline`
  );
  const attachmentSummary = (attachments.value ?? []).filter((attachment) => !attachment.isInline)[index];
  if (!attachmentSummary) return null;

  const attachment = await graphRequest<GraphAttachment>(
    config,
    `/users/${mailbox}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentSummary.id)}`
  );

  if (!attachment.contentBytes) {
    throw new Error("El adjunto de Microsoft no contiene contenido descargable.");
  }

  return {
    name: attachment.name || attachmentSummary.name || `adjunto-${index + 1}`,
    mimeType: attachment.contentType || attachmentSummary.contentType || "application/octet-stream",
    content: Buffer.from(attachment.contentBytes, "base64")
  };
}

function normalizeGraphRecipientInput(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value : value ? value.split(",") : [])
    .map((email) => email.trim())
    .filter(Boolean)
    .map((email) => ({
      emailAddress: {
        address: email
      }
    }));
}

async function sendMicrosoftGraphEmail(input: KingestionMailSendInput) {
  const config = getMicrosoftGraphConfig();
  const mailbox = normalizeGraphMailbox(config.mailbox);
  await graphRequest(config, `/users/${mailbox}/sendMail`, {
    method: "POST",
    body: JSON.stringify({
      message: {
        subject: input.subject,
        body: {
          contentType: input.html ? "HTML" : "Text",
          content: input.html || input.text
        },
        toRecipients: normalizeGraphRecipientInput(input.to),
        ccRecipients: normalizeGraphRecipientInput(input.cc)
      },
      saveToSentItems: true
    })
  });

  return {
    ok: true,
    messageId: null
  };
}

async function markMicrosoftGraphMessageAnswered(uid: string) {
  const messageId = decodeGraphUid(uid);
  if (!messageId) return { ok: false, uid, answered: false };

  const config = getMicrosoftGraphConfig();
  const mailbox = normalizeGraphMailbox(config.mailbox);
  await graphRequest(config, `/users/${mailbox}/messages/${encodeURIComponent(messageId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      isRead: true
    })
  });

  return {
    ok: true,
    uid,
    answered: true
  };
}

function normalizeAddress(address?: AddressLike | null) {
  return {
    name: address?.name?.trim() || address?.address?.trim() || "Sin remitente",
    email: address?.address?.trim() || ""
  };
}

function stringifyAddresses(addresses: unknown) {
  const candidates = Array.isArray(addresses) ? addresses : [addresses];
  const values = candidates.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    if ("value" in entry && Array.isArray(entry.value)) return entry.value as AddressLike[];
    if ("address" in entry || "name" in entry) return [entry as AddressLike];
    return [];
  });

  return values
    .map((address) => {
      const normalized = normalizeAddress(address);
      return normalized.email ? `${normalized.name} <${normalized.email}>` : normalized.name;
    })
    .filter(Boolean);
}

function countBodyStructureAttachments(node: unknown): number {
  if (!node || typeof node !== "object") return 0;

  const value = node as {
    disposition?: string;
    filename?: string;
    childNodes?: unknown[];
  };
  const current =
    value.filename || value.disposition?.toLowerCase() === "attachment" || value.disposition?.toLowerCase() === "inline"
      ? 1
      : 0;

  return (
    current +
    (value.childNodes ?? []).reduce<number>((total, child) => total + countBodyStructureAttachments(child), 0)
  );
}

function decodeTextFromHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function flagsToSet(flags?: Set<string> | string[]) {
  return flags instanceof Set ? flags : new Set(flags ?? []);
}

function toIsoDate(value?: DateLike | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function envelopeToListItem(message: {
  uid: number;
  envelope?: {
    subject?: string;
    from?: AddressLike[];
    date?: DateLike;
  };
  internalDate?: DateLike;
  flags?: Set<string> | string[];
  size?: number;
  bodyStructure?: unknown;
}): KingstonMailListItem {
  const from = normalizeAddress(message.envelope?.from?.[0]);
  const flags = flagsToSet(message.flags);

  return {
    uid: String(message.uid),
    subject: message.envelope?.subject?.trim() || "(Sin asunto)",
    fromName: from.name,
    fromEmail: from.email,
    date: toIsoDate(message.envelope?.date ?? message.internalDate),
    size: message.size ?? null,
    seen: flags.has("\\Seen"),
    answered: flags.has("\\Answered"),
    attachmentCount: countBodyStructureAttachments(message.bodyStructure)
  };
}

export async function listKingstonMailboxMessages(limit = 50) {
  if (getMailProvider() === "microsoft-graph") {
    return listMicrosoftGraphMessages(limit);
  }

  const config = getMailConfig();
  const client = createImapClient(config);

  await client.connect();
  try {
    const mailbox = await client.mailboxOpen(config.folder, { readOnly: true });
    if (!mailbox.exists) {
      return {
        folder: config.folder,
        count: 0,
        items: [] as KingstonMailListItem[]
      };
    }

    const start = Math.max(1, mailbox.exists - Math.max(limit * 2, limit) + 1);
    const items: KingstonMailListItem[] = [];

    for await (const message of client.fetch(`${start}:*`, {
      uid: true,
      envelope: true,
      flags: true,
      internalDate: true,
      size: true,
      bodyStructure: true
    })) {
      items.push(envelopeToListItem(message));
    }

    items.sort((left, right) => {
      const leftTime = left.date ? new Date(left.date).getTime() : 0;
      const rightTime = right.date ? new Date(right.date).getTime() : 0;
      return rightTime - leftTime;
    });

    return {
      folder: config.folder,
      count: mailbox.exists,
      items: items.slice(0, limit)
    };
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function getKingstonMailboxMessage(uid: string | number): Promise<KingstonMailMessage | null> {
  const normalizedUid = normalizeMailboxUid(uid);
  if (getMailProvider() === "microsoft-graph") {
    return getMicrosoftGraphMessage(normalizedUid);
  }

  const imapUid = Number(normalizedUid);
  if (!Number.isInteger(imapUid) || imapUid <= 0) return null;

  const config = getMailConfig();
  const client = createImapClient(config);

  await client.connect();
  try {
    await client.mailboxOpen(config.folder, { readOnly: true });
    const message = await client.fetchOne(
      imapUid,
      {
        uid: true,
        envelope: true,
        flags: true,
        internalDate: true,
        size: true,
        bodyStructure: true,
        source: true
      },
      { uid: true }
    );

    if (!message || !message.source) {
      return null;
    }

    const parsed = await simpleParser(message.source);
    const listItem = envelopeToListItem(message);
    const html = typeof parsed.html === "string" ? parsed.html : null;
    const text = parsed.text?.trim() || (html ? decodeTextFromHtml(html) : "");

    return {
      ...listItem,
      subject: parsed.subject?.trim() || listItem.subject,
      messageId: parsed.messageId ?? null,
      to: stringifyAddresses(parsed.to),
      cc: stringifyAddresses(parsed.cc),
      replyTo: stringifyAddresses(parsed.replyTo),
      text,
      html,
      attachments: parsed.attachments.map((attachment, index) => ({
        index,
        name: attachment.filename || `adjunto-${index + 1}`,
        mimeType: attachment.contentType || "application/octet-stream",
        size: attachment.size || attachment.content.length
      }))
    };
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function getKingstonMailboxAttachment(uid: string | number, index: number) {
  const normalizedUid = normalizeMailboxUid(uid);
  if (getMailProvider() === "microsoft-graph") {
    return getMicrosoftGraphAttachment(normalizedUid, index);
  }

  const imapUid = Number(normalizedUid);
  if (!Number.isInteger(imapUid) || imapUid <= 0) return null;

  const config = getMailConfig();
  const client = createImapClient(config);

  await client.connect();
  try {
    await client.mailboxOpen(config.folder, { readOnly: true });
    const message = await client.fetchOne(imapUid, { source: true }, { uid: true });
    if (!message || !message.source) return null;

    const parsed = await simpleParser(message.source);
    const attachment = parsed.attachments[index];
    if (!attachment) return null;

    return {
      name: attachment.filename || `adjunto-${index + 1}`,
      mimeType: attachment.contentType || "application/octet-stream",
      content: attachment.content
    };
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function replyToKingstonMailboxMessage(uid: string | number, input: KingstonMailReplyInput) {
  const draft = await buildKingstonMailboxReplyDraft(uid, input);
  await sendKingestionEmail(draft);
  await markKingstonMailboxMessageAnswered(uid);

  return {
    ok: true,
    uid,
    answered: true
  };
}

export async function buildKingstonMailboxReplyDraft(
  uid: string | number,
  input: KingstonMailReplyInput
): Promise<KingestionMailSendInput> {
  const original = await getKingstonMailboxMessage(uid);

  if (!original) {
    throw new Error("No pude encontrar el correo original.");
  }

  const subject = /^re:/i.test(original.subject) ? original.subject : `Re: ${original.subject}`;

  return {
    to: input.to,
    cc: input.cc || undefined,
    subject,
    text: input.body,
    inReplyTo: original.messageId || undefined,
    references: original.messageId ? [original.messageId] : undefined
  };
}

export async function markKingstonMailboxMessageAnswered(uid: string | number) {
  const normalizedUid = normalizeMailboxUid(uid);
  if (getMailProvider() === "microsoft-graph") {
    return markMicrosoftGraphMessageAnswered(normalizedUid);
  }

  const imapUid = Number(normalizedUid);
  if (!Number.isInteger(imapUid) || imapUid <= 0) {
    return {
      ok: false,
      uid: normalizedUid,
      answered: false
    };
  }

  const config = getMailConfig();
  const client = createImapClient(config);
  await client.connect();
  try {
    await client.mailboxOpen(config.folder);
    await client.messageFlagsAdd(imapUid, ["\\Answered"], { uid: true });
  } finally {
    await client.logout().catch(() => undefined);
  }

  return {
    ok: true,
    uid: normalizedUid,
    answered: true
  };
}

export async function sendKingestionEmail(input: KingestionMailSendInput) {
  if (getMailProvider() === "microsoft-graph") {
    return sendMicrosoftGraphEmail(input);
  }

  const config = getMailConfig();
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.user,
      pass: config.password
    }
  });

  const result = await transporter.sendMail({
    from: config.fromEmail,
    to: input.to,
    cc: input.cc || undefined,
    subject: input.subject,
    text: input.text,
    html: input.html,
    inReplyTo: input.inReplyTo || undefined,
    references: input.references,
    messageId: input.messageId
  });

  return {
    ok: true,
    messageId: result.messageId ?? null
  };
}
