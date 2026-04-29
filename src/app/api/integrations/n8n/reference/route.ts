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
          statuses: ["Liberar mercaderia", "OV creada"]
        },
        pendingService: {
          label: "Pendientes servicio tecnico",
          statuses: ["Informado", "Pedido deposito y etiquetado"]
        }
      },
      emailTemplates: [
        {
          slug: "kingston-confirmacion-recepcion",
          when: "Se crea o se detecta el caso desde el correo de autorizacion"
        },
        {
          slug: "cliente-instrucciones-envio",
          when: "El caso Interior / Gran Buenos Aires pasa a Aviso de envio"
        },
        {
          slug: "cliente-recepcion-confirmada",
          when: "El caso pasa a Producto recepcionado y en preparacion"
        },
        {
          slug: "cliente-demora-kingston",
          when: "El caso pasa a Pedido Kingston"
        },
        {
          slug: "cliente-guia-y-despacho",
          when: "El caso pasa a Producto enviado"
        },
        {
          slug: "cliente-retiro-disponible",
          when: "El caso Capital / AMBA pasa a Producto listo para retiro"
        },
        {
          slug: "cliente-cierre-realizado",
          when: "El caso pasa a Realizado"
        },
        {
          slug: "cliente-cierre-vencido",
          when: "El caso pasa a Vencido"
        },
        {
          slug: "cliente-cierre-administrativo",
          when: "El caso pasa a Cerrado"
        }
      ]
    });
  } catch (error) {
    return automationErrorResponse(error, "No pude devolver la referencia de automatizacion.");
  }
}
