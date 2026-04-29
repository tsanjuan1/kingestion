import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const outputDir = join(process.cwd(), "docs", "n8n");

mkdirSync(outputDir, { recursive: true });

function workflow(name, nodes, connections) {
  return {
    name,
    nodes,
    pinData: {},
    connections,
    active: false,
    settings: {
      executionOrder: "v1",
      timezone: "America/Argentina/Buenos_Aires"
    },
    versionId: randomUUID(),
    id: randomUUID().replace(/-/g, "").slice(0, 16),
    meta: {
      templateCredsSetupCompleted: false,
      instanceId: "kingestion-n8n-pack"
    },
    tags: []
  };
}

function node(id, name, type, position, parameters, extra = {}) {
  return {
    id,
    name,
    type,
    typeVersion:
      extra.typeVersion ??
      (type === "n8n-nodes-base.httpRequest"
        ? 4.3
        : type === "n8n-nodes-base.code"
          ? 2
          : type === "n8n-nodes-base.webhook"
            ? 2.1
            : type === "n8n-nodes-base.scheduleTrigger"
              ? 1.3
              : type === "n8n-nodes-base.emailReadImap"
                ? 2.1
                : type === "n8n-nodes-base.emailSend"
                  ? 2.1
                  : type === "@n8n/n8n-nodes-langchain.openAi"
                    ? 1.8
                    : 1),
    position,
    parameters,
    ...extra
  };
}

const commonHttpHeaders = {
  sendHeaders: true,
  headerParameters: {
    parameters: [
      {
        name: "x-kingestion-api-key",
        value: "={{ $env.KINGESTION_AUTOMATION_API_KEY }}"
      }
    ]
  }
};

const commonOpenAiModel = {
  __rl: true,
  value: "gpt-5-mini",
  mode: "list",
  cachedResultName: "GPT-5-MINI"
};

const workflow01 = workflow(
  "Kingestion 01 - Ingesta de autorizaciones Kingston",
  [
    node(
      "1",
      "Correo Kingston IMAP",
      "n8n-nodes-base.emailReadImap",
      [-920, -120],
      {
        postProcessAction: "nothing",
        downloadAttachments: true,
        options: {
          customEmailConfig:
            '=[\n  "UNSEEN",\n  ["FROM", "rma@kingston.com"]\n]'
        }
      }
    ),
    node("2", "Prueba manual", "n8n-nodes-base.manualTrigger", [-920, 120], {}),
    node(
      "3",
      "Mock correo manual",
      "n8n-nodes-base.code",
      [-700, 120],
      {
        jsCode: `return [{
  json: {
    from: 'rma@kingston.com',
    subject: 'Autorizacion RMA KS-998877 - Micro Delta SA',
    text: 'Kingston autoriza cambio de 12 modulos KF432C16BB/16 para Micro Delta SA. Contacto Nadia Ferreyra, email nadia.ferreyra@microdelta.com.ar, telefono +54 9 351 555-1200, direccion Av. Colon 4132 Piso 3, Cordoba Capital. Zona Interior / Gran Buenos Aires. Solicitar reintegro y envio del producto fallado.',
    receivedAt: new Date().toISOString(),
    attachments: []
  }
}];`
      }
    ),
    node(
      "4",
      "Normalizar correo Kingston",
      "n8n-nodes-base.code",
      [-460, -20],
      {
        jsCode: `const item = $input.first();
const json = item.json ?? {};
const attachments = [];

for (const [binaryKey, binaryFile] of Object.entries(item.binary ?? {})) {
  const buffer = await this.helpers.getBinaryDataBuffer(0, binaryKey);
  attachments.push({
    name: binaryFile.fileName ?? binaryKey,
    sizeLabel: binaryFile.fileSize ?? 'Adjunto',
    mimeType: binaryFile.mimeType ?? 'application/octet-stream',
    previewUrl: \`data:\${binaryFile.mimeType ?? 'application/octet-stream'};base64,\${buffer.toString('base64')}\`
  });
}

return [{
  json: {
    from: json.from ?? json.headers?.from ?? '',
    subject: json.subject ?? '',
    text: json.text ?? json.plainText ?? json.html ?? '',
    html: json.html ?? '',
    receivedAt: json.receivedAt ?? json.date ?? new Date().toISOString(),
    attachments
  }
}];`
      }
    ),
    node(
      "5",
      "IA interpreta autorizacion",
      "@n8n/n8n-nodes-langchain.openAi",
      [-220, -20],
      {
        modelId: commonOpenAiModel,
        messages: {
          values: [
            {
              content: `=Sos un analista operativo de ANYX para RMA Kingston.

Interpretá el siguiente correo y devolvé SOLO JSON valido con este schema:
{
  "kingstonNumber": "string",
  "clientName": "string",
  "contactName": "string",
  "contactEmail": "string",
  "contactPhone": "string",
  "zone": "Interior / Gran Buenos Aires" | "Capital / AMBA",
  "deliveryMode": "Dispatch" | "Pickup",
  "priority": "Low" | "Medium" | "High" | "Critical",
  "address": "string",
  "province": "string",
  "city": "string",
  "sku": "string",
  "quantity": number,
  "productDescription": "string",
  "failureDescription": "string",
  "nextAction": "string",
  "observations": "string",
  "origin": "Kingston email",
  "externalStatus": "Informado",
  "banking": {
    "bankName": "",
    "accountHolder": "",
    "cuit": "",
    "cbu": "",
    "alias": "",
    "accountNumber": ""
  }
}

Si falta un dato, completalo con la mejor inferencia operativa razonable y dejalo aclarado dentro de observations.

Asunto:
{{ $json.subject }}

Correo:
{{ $json.text }}`
            }
          ]
        },
        jsonOutput: true,
        options: {
          temperature: 0.1,
          maxTokens: 1800
        }
      }
    ),
    node(
      "6",
      "Consolidar payload del caso",
      "n8n-nodes-base.code",
      [20, -20],
      {
        jsCode: `const emailItem = $('Normalizar correo Kingston').first().json;
const aiItem = $input.first().json;
const raw =
  aiItem.json ??
  aiItem.output ??
  aiItem.response ??
  aiItem.result ??
  aiItem.message?.content ??
  aiItem.text ??
  aiItem.content ??
  aiItem;

let parsed = raw;
if (typeof raw === 'string') {
  const cleaned = raw.replace(/^\`\`\`json|^\`\`\`|\`\`\`$/gm, '').trim();
  const match = cleaned.match(/\\{[\\s\\S]*\\}/);
  parsed = JSON.parse(match ? match[0] : cleaned);
}

return [{
  json: {
    ...parsed,
    origin: 'Kingston email',
    externalStatus: 'Informado',
    attachments: emailItem.attachments ?? [],
    _emailContext: emailItem
  }
}];`
      }
    ),
    node(
      "7",
      "Buscar caso por ticket Kingston",
      "n8n-nodes-base.httpRequest",
      [280, -20],
      {
        method: "GET",
        url: "={{ $env.KINGESTION_BASE_URL + '/api/integrations/n8n/cases?kingstonNumber=' + encodeURIComponent($json.kingstonNumber) + '&includeArchived=true' }}",
        ...commonHttpHeaders,
        options: {}
      }
    ),
    node(
      "8",
      "Existe caso previo",
      "n8n-nodes-base.if",
      [520, -20],
      {
        conditions: {
          options: {
            caseSensitive: true,
            leftValue: "",
            typeValidation: "strict",
            version: 2
          },
          conditions: [
            {
              leftValue: "={{ $json.count }}",
              rightValue: 0,
              operator: {
                type: "number",
                operation: "larger"
              }
            }
          ],
          combinator: "and"
        },
        options: {}
      },
      { typeVersion: 2.2 }
    ),
    node(
      "9",
      "Crear caso en Kingestion",
      "n8n-nodes-base.httpRequest",
      [760, -160],
      {
        method: "POST",
        url: "={{ $env.KINGESTION_BASE_URL + '/api/integrations/n8n/cases' }}",
        ...commonHttpHeaders,
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ JSON.stringify($('Consolidar payload del caso').first().json) }}",
        options: {}
      }
    ),
    node(
      "10",
      "Actualizar caso existente",
      "n8n-nodes-base.httpRequest",
      [760, 120],
      {
        method: "PATCH",
        url: "={{ $env.KINGESTION_BASE_URL + '/api/integrations/n8n/cases/' + $json.items[0].id }}",
        ...commonHttpHeaders,
        sendBody: true,
        specifyBody: "json",
        jsonBody:
          "={{ JSON.stringify({ comment: { body: 'n8n detecto un nuevo correo de autorizacion o seguimiento de Kingston y lo agrego al caso.', internal: true }, attachment: $('Consolidar payload del caso').first().json.attachments?.[0] }) }}",
        options: {}
      }
    ),
    node(
      "11",
      "Preparar correos iniciales",
      "n8n-nodes-base.code",
      [1020, -20],
      {
        jsCode: `const caseItem = $('Consolidar payload del caso').first().json;
const wasExisting = $('Existe caso previo').first().json.count > 0;

const emails = [
  {
    toEmail: $env.KINGSTON_RMA_TO ?? 'rma@kingston.com',
    subject: \`ANYX | Caso \${caseItem.kingstonNumber} recibido\`,
    text: wasExisting
      ? \`Se actualizo en Kingestion el caso \${caseItem.kingstonNumber}. Queda trazado para seguimiento interno.\`
      : \`Se recibio y dio de alta el caso \${caseItem.kingstonNumber} en Kingestion para \${caseItem.clientName}.\`
  }
];

if (caseItem.zone === 'Interior / Gran Buenos Aires') {
  emails.push({
    toEmail: caseItem.contactEmail,
    subject: \`ANYX | Instrucciones de envio para \${caseItem.kingstonNumber}\`,
    text: \`Hola \${caseItem.contactName}. Recibimos la autorizacion de Kingston para el caso \${caseItem.kingstonNumber}. Por favor envia el producto fallado a ANYX y responde este correo con el comprobante y los datos bancarios para el reintegro.\`
  });
} else {
  emails.push({
    toEmail: caseItem.contactEmail,
    subject: \`ANYX | Caso \${caseItem.kingstonNumber} en validacion\`,
    text: \`Hola \${caseItem.contactName}. Recibimos la autorizacion de Kingston para el caso \${caseItem.kingstonNumber}. El equipo de ANYX ya esta validando stock y proximo paso. Te vamos a mantener informado desde Kingestion.\`
  });
}

return emails.map((email) => ({ json: email }));`
      }
    ),
    node(
      "12",
      "Enviar emails iniciales",
      "n8n-nodes-base.emailSend",
      [1260, -20],
      {
        fromEmail: "={{ $env.KINGESTION_FROM_EMAIL }}",
        toEmail: "={{ $json.toEmail }}",
        subject: "={{ $json.subject }}",
        emailFormat: "text",
        text: "={{ $json.text }}",
        options: {
          appendAttribution: false
        }
      }
    )
  ],
  {
    "Correo Kingston IMAP": {
      main: [[{ node: "Normalizar correo Kingston", type: "main", index: 0 }]]
    },
    "Prueba manual": {
      main: [[{ node: "Mock correo manual", type: "main", index: 0 }]]
    },
    "Mock correo manual": {
      main: [[{ node: "Normalizar correo Kingston", type: "main", index: 0 }]]
    },
    "Normalizar correo Kingston": {
      main: [[{ node: "IA interpreta autorizacion", type: "main", index: 0 }]]
    },
    "IA interpreta autorizacion": {
      main: [[{ node: "Consolidar payload del caso", type: "main", index: 0 }]]
    },
    "Consolidar payload del caso": {
      main: [[{ node: "Buscar caso por ticket Kingston", type: "main", index: 0 }]]
    },
    "Buscar caso por ticket Kingston": {
      main: [[{ node: "Existe caso previo", type: "main", index: 0 }]]
    },
    "Existe caso previo": {
      main: [
        [{ node: "Actualizar caso existente", type: "main", index: 0 }],
        [{ node: "Crear caso en Kingestion", type: "main", index: 0 }]
      ]
    },
    "Crear caso en Kingestion": {
      main: [[{ node: "Preparar correos iniciales", type: "main", index: 0 }]]
    },
    "Actualizar caso existente": {
      main: [[{ node: "Preparar correos iniciales", type: "main", index: 0 }]]
    },
    "Preparar correos iniciales": {
      main: [[{ node: "Enviar emails iniciales", type: "main", index: 0 }]]
    }
  }
);

const workflow02 = workflow(
  "Kingestion 02 - Seguimiento operativo y correos automáticos",
  [
    node(
      "1",
      "Schedule Trigger",
      "n8n-nodes-base.scheduleTrigger",
      [-920, -100],
      {
        rule: {
          interval: [
            {
              field: "minutes",
              minutesInterval: 10
            }
          ]
        }
      }
    ),
    node("2", "Prueba manual", "n8n-nodes-base.manualTrigger", [-920, 100], {}),
    node(
      "3",
      "Actividad reciente",
      "n8n-nodes-base.httpRequest",
      [-680, 0],
      {
        method: "GET",
        url: "={{ $env.KINGESTION_BASE_URL + '/api/integrations/n8n/activity?entityType=case&action=case-status-updated&limit=50&since=' + encodeURIComponent(new Date(Date.now() - 15 * 60 * 1000).toISOString()) }}",
        ...commonHttpHeaders,
        options: {}
      }
    ),
    node(
      "4",
      "Expandir eventos",
      "n8n-nodes-base.code",
      [-440, 0],
      {
        jsCode: `const items = $input.first().json.items ?? [];
return items.map((entry) => ({ json: entry }));`
      }
    ),
    node(
      "5",
      "Traer caso actualizado",
      "n8n-nodes-base.httpRequest",
      [-200, 0],
      {
        method: "GET",
        url: "={{ $env.KINGESTION_BASE_URL + '/api/integrations/n8n/cases/' + $json.entityId }}",
        ...commonHttpHeaders,
        options: {}
      }
    ),
    node(
      "6",
      "Definir comunicacion",
      "n8n-nodes-base.code",
      [40, 0],
      {
        jsCode: `const entry = $json.item;
const email = {
  caseId: entry.id,
  clientName: entry.clientName,
  contactName: entry.contactName,
  contactEmail: entry.contactEmail,
  status: entry.externalStatus,
  zone: entry.zone,
  nextAction: entry.nextAction,
  internalNumber: entry.internalNumber,
  kingstonNumber: entry.kingstonNumber,
  transporter: entry.logistics.transporter,
  guideNumber: entry.logistics.guideNumber,
  trackingUrl: entry.logistics.trackingUrl,
  subjectHint: '',
  destinationEmail: '',
  purpose: '',
  includeAiDraft: true
};

switch (entry.externalStatus) {
  case 'Aviso de envio':
    email.destinationEmail = entry.contactEmail;
    email.subjectHint = 'Instrucciones de envio';
    email.purpose = 'Enviar instrucciones para despacho del producto fallado y solicitud de comprobante.';
    break;
  case 'Producto recepcionado y en preparacion':
    email.destinationEmail = entry.contactEmail;
    email.subjectHint = 'Recepcion confirmada';
    email.purpose = 'Confirmar recepcion del producto fallado y avisar que ANYX valida stock y reintegro.';
    break;
  case 'Pedido Kingston':
    email.destinationEmail = entry.contactEmail;
    email.subjectHint = 'Demora por reposicion Kingston';
    email.purpose = 'Informar falta de stock local y que el caso depende de Kingston USA.';
    break;
  case 'Pedido deposito y etiquetado':
    email.destinationEmail = $env.KINGESTION_TECH_EMAIL ?? 'serviciotecnico@anyx.com.ar';
    email.subjectHint = 'Accion pendiente de servicio tecnico';
    email.purpose = 'Avisar a servicio tecnico que debe catalogar y etiquetar el reemplazo.';
    break;
  case 'Liberar mercaderia':
  case 'OV creada':
    email.destinationEmail = $env.KINGESTION_PURCHASING_EMAIL ?? 'compras@anyx.com.ar';
    email.subjectHint = 'Accion pendiente de compras';
    email.purpose = 'Avisar a compras que debe liberar mercaderia o continuar la OV.';
    break;
  case 'Pedido guia':
    email.destinationEmail = $env.KINGESTION_LOGISTICS_EMAIL ?? 'logistica@anyx.com.ar';
    email.subjectHint = 'Solicitud de guia';
    email.purpose = 'Solicitar a logistica y servicio tecnico la carga de guia y tracking.';
    break;
  case 'Producto enviado':
    email.destinationEmail = entry.contactEmail;
    email.subjectHint = 'Despacho confirmado';
    email.purpose = 'Informar al cliente que el reemplazo fue despachado, incluyendo guia y tracking.';
    break;
  case 'Producto listo para retiro':
    email.destinationEmail = entry.contactEmail;
    email.subjectHint = 'Producto listo para retiro';
    email.purpose = 'Informar al cliente que el reemplazo esta disponible para retiro en ANYX.';
    break;
  case 'Realizado':
  case 'Vencido':
  case 'Cerrado':
    email.destinationEmail = entry.contactEmail;
    email.subjectHint = 'Cierre de caso';
    email.purpose = 'Informar al cliente el cierre final del caso con el contexto correspondiente.';
    break;
  default:
    return [];
}

return [{ json: email }];`
      }
    ),
    node(
      "7",
      "IA redacta correo",
      "@n8n/n8n-nodes-langchain.openAi",
      [300, 0],
      {
        modelId: commonOpenAiModel,
        messages: {
          values: [
            {
              content: `=Actua como coordinador operativo de ANYX para RMA Kingston.

Redacta SOLO JSON valido con este schema:
{
  "subject": "string",
  "text": "string"
}

Objetivo del correo: {{ $json.purpose }}
Numero interno: {{ $json.internalNumber }}
Caso Kingston: {{ $json.kingstonNumber }}
Cliente: {{ $json.clientName }}
Contacto: {{ $json.contactName }}
Estado: {{ $json.status }}
Zona: {{ $json.zone }}
Proxima accion: {{ $json.nextAction }}
Transportista: {{ $json.transporter || 'No definido' }}
Guia: {{ $json.guideNumber || 'No definida' }}
Tracking: {{ $json.trackingUrl || 'No informado' }}

El texto debe quedar profesional, breve, claro y totalmente en español.`
            }
          ]
        },
        jsonOutput: true,
        options: {
          temperature: 0.2,
          maxTokens: 1200
        }
      }
    ),
    node(
      "8",
      "Parsear correo IA",
      "n8n-nodes-base.code",
      [560, 0],
      {
        jsCode: `const context = $('Definir comunicacion').first().json;
const raw = $input.first().json.json ?? $input.first().json.output ?? $input.first().json.message?.content ?? $input.first().json.text ?? $input.first().json;
let parsed = raw;

if (typeof raw === 'string') {
  const cleaned = raw.replace(/^\`\`\`json|^\`\`\`|\`\`\`$/gm, '').trim();
  const match = cleaned.match(/\\{[\\s\\S]*\\}/);
  parsed = JSON.parse(match ? match[0] : cleaned);
}

return [{
  json: {
    ...context,
    subject: parsed.subject,
    text: parsed.text
  }
}];`
      }
    ),
    node(
      "9",
      "Enviar correo operacional",
      "n8n-nodes-base.emailSend",
      [820, 0],
      {
        fromEmail: "={{ $env.KINGESTION_FROM_EMAIL }}",
        toEmail: "={{ $json.destinationEmail }}",
        subject: "={{ $json.subject }}",
        emailFormat: "text",
        text: "={{ $json.text }}",
        options: {
          appendAttribution: false
        }
      }
    ),
    node(
      "10",
      "Registrar comentario",
      "n8n-nodes-base.httpRequest",
      [1080, 0],
      {
        method: "PATCH",
        url: "={{ $env.KINGESTION_BASE_URL + '/api/integrations/n8n/cases/' + $json.caseId }}",
        ...commonHttpHeaders,
        sendBody: true,
        specifyBody: "json",
        jsonBody:
          "={{ JSON.stringify({ comment: { body: 'n8n envio correo automatico para el estado ' + $json.status + ': ' + $json.subject, internal: true } }) }}",
        options: {}
      }
    )
  ],
  {
    "Schedule Trigger": {
      main: [[{ node: "Actividad reciente", type: "main", index: 0 }]]
    },
    "Prueba manual": {
      main: [[{ node: "Actividad reciente", type: "main", index: 0 }]]
    },
    "Actividad reciente": {
      main: [[{ node: "Expandir eventos", type: "main", index: 0 }]]
    },
    "Expandir eventos": {
      main: [[{ node: "Traer caso actualizado", type: "main", index: 0 }]]
    },
    "Traer caso actualizado": {
      main: [[{ node: "Definir comunicacion", type: "main", index: 0 }]]
    },
    "Definir comunicacion": {
      main: [[{ node: "IA redacta correo", type: "main", index: 0 }]]
    },
    "IA redacta correo": {
      main: [[{ node: "Parsear correo IA", type: "main", index: 0 }]]
    },
    "Parsear correo IA": {
      main: [[{ node: "Enviar correo operacional", type: "main", index: 0 }]]
    },
    "Enviar correo operacional": {
      main: [[{ node: "Registrar comentario", type: "main", index: 0 }]]
    }
  }
);

const workflow03 = workflow(
  "Kingestion 03 - Copiloto IA operativo",
  [
    node(
      "1",
      "Webhook Copiloto",
      "n8n-nodes-base.webhook",
      [-920, 0],
      {
        httpMethod: "POST",
        path: "kingestion-copilot",
        responseMode: "lastNode",
        responseData: "allEntries",
        options: {}
      },
      {
        webhookId: "kingestion-copilot"
      }
    ),
    node(
      "2",
      "Buscar casos relacionados",
      "n8n-nodes-base.httpRequest",
      [-660, -80],
      {
        method: "GET",
        url: "={{ $env.KINGESTION_BASE_URL + '/api/integrations/n8n/cases?q=' + encodeURIComponent($json.body?.message ?? $json.message ?? '') + '&includeArchived=true' }}",
        ...commonHttpHeaders,
        options: {}
      }
    ),
    node(
      "3",
      "Referencia workflow",
      "n8n-nodes-base.httpRequest",
      [-660, 80],
      {
        method: "GET",
        url: "={{ $env.KINGESTION_BASE_URL + '/api/integrations/n8n/reference' }}",
        ...commonHttpHeaders,
        options: {}
      }
    ),
    node(
      "4",
      "Preparar contexto copiloto",
      "n8n-nodes-base.code",
      [-380, 0],
      {
        jsCode: `const body = $('Webhook Copiloto').first().json.body ?? $('Webhook Copiloto').first().json;
const matches = $('Buscar casos relacionados').first().json.items ?? [];
const reference = $('Referencia workflow').first().json;

return [{
  json: {
    message: body.message ?? '',
    allowWrites: Boolean(body.allowWrites),
    explicitCaseId: body.caseId ?? null,
    caseMatches: matches.slice(0, 5),
    reference
  }
}];`
      }
    ),
    node(
      "5",
      "IA decide accion",
      "@n8n/n8n-nodes-langchain.openAi",
      [-120, 0],
      {
        modelId: commonOpenAiModel,
        messages: {
          values: [
            {
              content: `=Sos el copiloto operativo de Kingestion.

Dispones de una API para:
- buscar casos
- leer un caso puntual
- cambiar estado
- agregar comentario
- marcar reintegro completo
- completar cola de compras o servicio tecnico

IMPORTANTE:
- si allowWrites es false, NUNCA propongas una accion que escriba
- devolve SOLO JSON valido con este schema:
{
  "action": "search" | "read_case" | "update_status" | "add_comment" | "complete_reimbursement" | "complete_queue" | "answer_only",
  "caseId": "string | null",
  "status": "string | null",
  "comment": "string | null",
  "reply": "string"
}

Mensaje del operador:
{{ $json.message }}

Allow writes:
{{ $json.allowWrites }}

CaseId explicito:
{{ $json.explicitCaseId || 'ninguno' }}

Casos encontrados:
{{ JSON.stringify($json.caseMatches, null, 2) }}

Referencia de workflow:
{{ JSON.stringify($json.reference.workflowStates, null, 2) }}`
            }
          ]
        },
        jsonOutput: true,
        options: {
          temperature: 0.1,
          maxTokens: 1400
        }
      }
    ),
    node(
      "6",
      "Construir accion",
      "n8n-nodes-base.code",
      [140, 0],
      {
        jsCode: `const context = $('Preparar contexto copiloto').first().json;
const raw = $input.first().json.json ?? $input.first().json.output ?? $input.first().json.message?.content ?? $input.first().json;
let parsed = raw;

if (typeof raw === 'string') {
  const cleaned = raw.replace(/^\`\`\`json|^\`\`\`|\`\`\`$/gm, '').trim();
  const match = cleaned.match(/\\{[\\s\\S]*\\}/);
  parsed = JSON.parse(match ? match[0] : cleaned);
}

const firstMatch = context.caseMatches[0] ?? null;
const caseId = parsed.caseId || context.explicitCaseId || firstMatch?.id || null;
const action = parsed.action || 'answer_only';

if (action === 'update_status' && caseId && context.allowWrites) {
  return [{
    json: {
      reply: parsed.reply,
      request: {
        method: 'PATCH',
        url: $env.KINGESTION_BASE_URL + '/api/integrations/n8n/cases/' + caseId,
        body: { status: parsed.status }
      }
    }
  }];
}

if (action === 'add_comment' && caseId && context.allowWrites) {
  return [{
    json: {
      reply: parsed.reply,
      request: {
        method: 'PATCH',
        url: $env.KINGESTION_BASE_URL + '/api/integrations/n8n/cases/' + caseId,
        body: { comment: { body: parsed.comment || parsed.reply, internal: true } }
      }
    }
  }];
}

if (action === 'complete_reimbursement' && caseId && context.allowWrites) {
  return [{
    json: {
      reply: parsed.reply,
      request: {
        method: 'PATCH',
        url: $env.KINGESTION_BASE_URL + '/api/integrations/n8n/cases/' + caseId,
        body: { completeReimbursement: true }
      }
    }
  }];
}

if (action === 'complete_queue' && caseId && context.allowWrites) {
  return [{
    json: {
      reply: parsed.reply,
      request: {
        method: 'PATCH',
        url: $env.KINGESTION_BASE_URL + '/api/integrations/n8n/cases/' + caseId,
        body: { completeQueueStep: true }
      }
    }
  }];
}

if (action === 'read_case' && caseId) {
  return [{
    json: {
      reply: parsed.reply,
      request: {
        method: 'GET',
        url: $env.KINGESTION_BASE_URL + '/api/integrations/n8n/cases/' + caseId
      }
    }
  }];
}

return [{
  json: {
    reply: parsed.reply,
    request: {
      method: 'GET',
      url: $env.KINGESTION_BASE_URL + '/api/integrations/n8n/cases?q=' + encodeURIComponent(context.message) + '&includeArchived=true'
    }
  }
}];`
      }
    ),
    node(
      "7",
      "Ejecutar accion en Kingestion",
      "n8n-nodes-base.httpRequest",
      [400, 0],
      {
        method: "={{ $json.request.method }}",
        url: "={{ $json.request.url }}",
        ...commonHttpHeaders,
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ $json.request.body ? JSON.stringify($json.request.body) : '{}' }}",
        options: {}
      }
    ),
    node(
      "8",
      "Respuesta final",
      "n8n-nodes-base.code",
      [660, 0],
      {
        jsCode: `const planned = $('Construir accion').first().json;
const result = $input.first().json;

return [{
  json: {
    ok: true,
    message: planned.reply,
    result
  }
}];`
      }
    )
  ],
  {
    "Webhook Copiloto": {
      main: [
        [{ node: "Buscar casos relacionados", type: "main", index: 0 }],
        [{ node: "Referencia workflow", type: "main", index: 0 }]
      ]
    },
    "Buscar casos relacionados": {
      main: [[{ node: "Preparar contexto copiloto", type: "main", index: 0 }]]
    },
    "Referencia workflow": {
      main: [[{ node: "Preparar contexto copiloto", type: "main", index: 1 }]]
    },
    "Preparar contexto copiloto": {
      main: [[{ node: "IA decide accion", type: "main", index: 0 }]]
    },
    "IA decide accion": {
      main: [[{ node: "Construir accion", type: "main", index: 0 }]]
    },
    "Construir accion": {
      main: [[{ node: "Ejecutar accion en Kingestion", type: "main", index: 0 }]]
    },
    "Ejecutar accion en Kingestion": {
      main: [[{ node: "Respuesta final", type: "main", index: 0 }]]
    }
  }
);

const workflow04 = workflow(
  "Kingestion 04 - Alertas SLA y seguimiento diario",
  [
    node(
      "1",
      "Schedule Trigger",
      "n8n-nodes-base.scheduleTrigger",
      [-760, -100],
      {
        rule: {
          interval: [
            {
              field: "days",
              triggerAtHour: 9,
              triggerAtMinute: 0
            }
          ]
        }
      }
    ),
    node("2", "Prueba manual", "n8n-nodes-base.manualTrigger", [-760, 100], {}),
    node(
      "3",
      "Casos abiertos",
      "n8n-nodes-base.httpRequest",
      [-520, 0],
      {
        method: "GET",
        url: "={{ $env.KINGESTION_BASE_URL + '/api/integrations/n8n/cases?queue=open' }}",
        ...commonHttpHeaders,
        options: {}
      }
    ),
    node(
      "4",
      "Construir digest",
      "n8n-nodes-base.code",
      [-280, 0],
      {
        jsCode: `const items = $input.first().json.items ?? [];
const now = Date.now();

const critical = items.filter((entry) => {
  const due = new Date(entry.slaDueAt).getTime();
  const hoursRemaining = Math.round((due - now) / (1000 * 60 * 60));
  return hoursRemaining <= 24 || entry.externalStatus === 'Pedido Kingston';
});

const lines = critical.map((entry) => {
  const due = new Date(entry.slaDueAt).toLocaleString('es-AR');
  return \`- \${entry.internalNumber} | \${entry.clientName} | \${entry.externalStatus} | SLA \${due} | Responsable: \${entry.owner}\`;
});

return [{
  json: {
    totalOpenCases: items.length,
    criticalCount: critical.length,
    lines
  }
}];`
      }
    ),
    node(
      "5",
      "IA redacta digest",
      "@n8n/n8n-nodes-langchain.openAi",
      [-40, 0],
      {
        modelId: commonOpenAiModel,
        messages: {
          values: [
            {
              content: `=Redacta SOLO JSON valido con este schema:
{
  "subject": "string",
  "text": "string"
}

Contexto:
- Casos abiertos totales: {{ $json.totalOpenCases }}
- Casos criticos hoy: {{ $json.criticalCount }}
- Detalle:
{{ $json.lines.join('\\n') }}

El texto debe quedar en español y con foco operativo para supervisores de ANYX.`
            }
          ]
        },
        jsonOutput: true,
        options: {
          temperature: 0.2,
          maxTokens: 900
        }
      }
    ),
    node(
      "6",
      "Parsear digest IA",
      "n8n-nodes-base.code",
      [220, 0],
      {
        jsCode: `const raw = $input.first().json.json ?? $input.first().json.output ?? $input.first().json.message?.content ?? $input.first().json;
let parsed = raw;

if (typeof raw === 'string') {
  const cleaned = raw.replace(/^\`\`\`json|^\`\`\`|\`\`\`$/gm, '').trim();
  const match = cleaned.match(/\\{[\\s\\S]*\\}/);
  parsed = JSON.parse(match ? match[0] : cleaned);
}

return [{ json: parsed }];`
      }
    ),
    node(
      "7",
      "Enviar digest",
      "n8n-nodes-base.emailSend",
      [480, 0],
      {
        fromEmail: "={{ $env.KINGESTION_FROM_EMAIL }}",
        toEmail: "={{ $env.KINGESTION_SUPERVISION_EMAIL }}",
        subject: "={{ $json.subject }}",
        emailFormat: "text",
        text: "={{ $json.text }}",
        options: {
          appendAttribution: false
        }
      }
    )
  ],
  {
    "Schedule Trigger": {
      main: [[{ node: "Casos abiertos", type: "main", index: 0 }]]
    },
    "Prueba manual": {
      main: [[{ node: "Casos abiertos", type: "main", index: 0 }]]
    },
    "Casos abiertos": {
      main: [[{ node: "Construir digest", type: "main", index: 0 }]]
    },
    "Construir digest": {
      main: [[{ node: "IA redacta digest", type: "main", index: 0 }]]
    },
    "IA redacta digest": {
      main: [[{ node: "Parsear digest IA", type: "main", index: 0 }]]
    },
    "Parsear digest IA": {
      main: [[{ node: "Enviar digest", type: "main", index: 0 }]]
    }
  }
);

const files = [
  ["kingestion-01-ingesta-autorizaciones.json", workflow01],
  ["kingestion-02-seguimiento-operativo.json", workflow02],
  ["kingestion-03-copiloto-ia.json", workflow03],
  ["kingestion-04-alertas-sla.json", workflow04]
];

for (const [fileName, definition] of files) {
  writeFileSync(join(outputDir, fileName), `${JSON.stringify(definition, null, 2)}\n`, "utf8");
}

console.log(`Se generaron ${files.length} workflows de n8n en ${outputDir}`);
