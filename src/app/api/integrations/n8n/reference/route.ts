import { NextResponse } from "next/server";

import { authorizeAutomationRequest, automationErrorResponse } from "@/app/api/integrations/n8n/_lib";
import { transitionRules, workflowStates } from "@/lib/kingston/data";

export async function GET(request: Request) {
  const unauthorizedResponse = authorizeAutomationRequest(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      workflowStates,
      transitionRules,
      queues: {
        reimbursements: {
          label: "Pendientes de reintegro",
          trigger: "Zona Interior / Gran Buenos Aires y reintegro no completado"
        },
        pendingPurchases: {
          label: "Pendientes compras",
          statuses: ["OV creada", "Pedido Kingston"]
        },
        pendingService: {
          label: "Pendientes servicio tecnico",
          statuses: ["Informado", "Pedido deposito y etiquetado"]
        }
      },
      cloudControl: {
        endpoint: "/api/integrations/n8n/control/kingston-rma",
        purpose: "Permite que n8n consulte si el piloto cloud esta pausado manualmente desde Kingestion."
      },
      emailTemplates: [
        {
          slug: "kingston-acuse-recepcion-remitente",
          when: "Se detecta un nuevo correo de autorizacion de Kingston y se responde al remitente confirmando recepcion"
        },
        {
          slug: "cliente-confirmacion-autorizacion",
          when: "Se crea un caso nuevo en Kingestion y se informa al end user que la autorizacion fue recibida"
        },
        {
          slug: "cliente-instrucciones-envio-y-formulario",
          when: "El caso Interior / Gran Buenos Aires pasa a Aviso de envio"
        },
        {
          slug: "cliente-recepcion-confirmada",
          when: "El caso pasa a Producto recepcionado y en preparacion"
        },
        {
          slug: "interno-compras-ov-creada",
          when: "El caso pasa a OV creada y debe notificarse a compras"
        },
        {
          slug: "interno-gustavo-pedido-kingston",
          when: "El caso pasa a Pedido Kingston y se requiere consolidar el faltante para Kingston EEUU"
        },
        {
          slug: "cliente-demora-por-falta-local",
          when: "El caso pasa a Pedido Kingston y se avisa al cliente la falta de stock local"
        },
        {
          slug: "interno-servicio-tecnico-catalogacion",
          when: "El caso pasa a Pedido deposito y etiquetado y debe avisarse a servicio tecnico"
        },
        {
          slug: "cliente-despacho-confirmado",
          when: "El caso Interior / Gran Buenos Aires pasa a Producto enviado"
        },
        {
          slug: "cliente-retiro-disponible",
          when: "El caso Capital / AMBA pasa a Producto listo para retiro"
        },
        {
          slug: "cliente-cierre-caso",
          when: "El caso pasa a Realizado, Vencido o Cerrado"
        },
        {
          slug: "cliente-consulta-segun-estado",
          when: "El cliente escribe consultando por un caso ya existente y el workflow responde segun el estado actual del caso"
        }
      ],
      statusInquiryMatrix: [
        {
          trigger: "Informado",
          audience: "Cliente",
          behavior: "Responder al end user con el texto heredado de SharePoint para caso recibido y en proceso."
        },
        {
          trigger: "Aviso de envio",
          audience: "Cliente",
          behavior: "Responder al end user que se espera la recepcion del producto fallado y recordarle las instrucciones previas."
        },
        {
          trigger: "Producto recepcionado y en preparacion",
          audience: "Cliente",
          behavior: "Responder al end user confirmando recepcion del fallado y que recibira una actualizacion dentro de los proximos 10 dias habiles."
        },
        {
          trigger: "Pedido deposito y etiquetado",
          audience: "Cliente",
          behavior: "Responder con el texto heredado de Pedido etiqueta / Pedido deposito: producto en preparacion y novedades dentro de 5 dias habiles."
        },
        {
          trigger: "Pedido Kingston",
          audience: "Cliente",
          behavior: "Responder que el reemplazo no esta disponible en Argentina y fue solicitado a Kingston EEUU."
        },
        {
          trigger: "Producto enviado",
          audience: "Cliente",
          behavior: "Responder que el reemplazo ya fue enviado y que debe corroborar con el expreso."
        },
        {
          trigger: "Producto listo para retiro",
          audience: "Cliente",
          behavior: "Responder con la direccion y los dias/horarios de retiro definidos por ANYX."
        },
        {
          trigger: "Realizado",
          audience: "Cliente",
          behavior: "Responder que el producto fue cambiado con exito y el RMA finalizo."
        },
        {
          trigger: "Vencido",
          audience: "Cliente",
          behavior: "Responder que el caso vencio por falta de respuesta y que debe generar una nueva solicitud si quiere continuar."
        },
        {
          trigger: "Cerrado",
          audience: "Cliente",
          behavior: "Responder que Kingston cerro el caso y cualquier consulta debe volver a canalizarse con Kingston."
        },
        {
          trigger: "OV creada",
          audience: "Cliente",
          behavior: "No enviar correo al cliente. Es un estado interno de compras."
        }
      ],
      notificationPlaybook: [
        {
          legacyStep: "2",
          trigger: "ingesta-nueva-autorizacion",
          audience: "Kingston",
          templateSlug: "kingston-acuse-recepcion-remitente",
          detail: "Acuse automático al remitente de Kingston confirmando que ANYX recibió y registró el caso."
        },
        {
          legacyStep: "3",
          trigger: "ingesta-nueva-autorizacion",
          audience: "Cliente",
          templateSlug: "cliente-confirmacion-autorizacion",
          detail: "Confirmación inicial al end user indicando que la autorización quedó recibida y registrada en Kingestion."
        },
        {
          legacyStep: "6.1",
          trigger: "Aviso de envio",
          audience: "Cliente",
          templateSlug: "cliente-instrucciones-envio-y-formulario",
          detail: "Instrucciones de envío, pedido de comprobante oficial y link al formulario web para datos de entrega y bancarios."
        },
        {
          legacyStep: "6.2",
          trigger: "Producto recepcionado y en preparacion",
          audience: "Cliente",
          templateSlug: "cliente-recepcion-confirmada",
          detail: "Aviso automático al cliente confirmando que ANYX ya recibió el producto fallado."
        },
        {
          legacyStep: "7.2",
          trigger: "Pedido Kingston",
          audience: "Interno y Cliente",
          templateSlug: "interno-gustavo-pedido-kingston / cliente-demora-por-falta-local",
          detail: "Mail interno para consolidar pedido a Kingston y mail externo al cliente informando falta local y pedido a EEUU."
        },
        {
          legacyStep: "7.3 / 10",
          trigger: "Pedido deposito y etiquetado",
          audience: "Servicio tecnico",
          templateSlug: "interno-servicio-tecnico-catalogacion",
          detail: "Aviso a servicio técnico para catalogar el reemplazo como RMA y disponerlo para envío o retiro."
        },
        {
          legacyStep: "7.4",
          trigger: "Producto enviado",
          audience: "Cliente",
          templateSlug: "cliente-despacho-confirmado",
          detail: "Aviso de despacho al cliente con guía y tracking si ya existen, o aclaración de que se informarán luego."
        },
        {
          legacyStep: "12",
          trigger: "Producto listo para retiro",
          audience: "Cliente",
          templateSlug: "cliente-retiro-disponible",
          detail: "Aviso al end user con instrucciones para retirar el reemplazo en ANYX."
        },
        {
          legacyStep: "consulta-estado-sharepoint",
          trigger: "consulta-cliente-caso-existente",
          audience: "Cliente",
          templateSlug: "cliente-consulta-segun-estado",
          detail:
            "Cuando el cliente escribe consultando por su caso, el workflow responde segun la matriz heredada del SharePoint. OV creada queda como estado interno y no dispara correo al cliente."
        }
      ],
      aiCapabilities: [
        "Interpretar correos nuevos y seguimientos de Kingston",
        "Detectar faltantes razonables sin romper el workflow actual",
        "Redactar avisos en espanol segun el estado del caso",
        "Responder consultas del cliente segun el estado actual del caso respetando la matriz heredada",
        "Reconocer comprobantes de pago o reintegro y sugerir adjuntarlos al caso"
      ]
    });
  } catch (error) {
    return automationErrorResponse(error, "No pude devolver la referencia de automatizacion.");
  }
}
