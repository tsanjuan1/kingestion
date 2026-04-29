import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizeAutomationRequest, automationErrorResponse } from "@/app/api/integrations/n8n/_lib";
import type { CreateCaseInput } from "@/lib/kingston/contracts";
import {
  automationQueueValues,
  automationReimbursementValues,
  automationStatusValues,
  automationZoneValues,
  parseBooleanParam
} from "@/lib/kingston/automation";
import { createAutomationCase, listAutomationCases } from "@/lib/kingston/server";
import type { AutomationCaseFilters } from "@/lib/kingston/server";

const attachmentSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["mail", "photo", "proof", "guide", "form"]).optional(),
  sizeLabel: z.string().min(1),
  mimeType: z.string().optional(),
  previewUrl: z.string().optional()
});

const createCaseSchema = z.object({
  kingstonNumber: z.string().min(1),
  clientName: z.string().min(1),
  contactName: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(1),
  owner: z.string().default("Sin asignar"),
  externalStatus: z.string().refine((value) => automationStatusValues.includes(value as never), {
    message: "Estado externo invalido."
  }),
  zone: z.string().refine((value) => automationZoneValues.includes(value as never), {
    message: "Zona invalida."
  }),
  deliveryMode: z.enum(["Dispatch", "Pickup"]),
  priority: z.enum(["Low", "Medium", "High", "Critical"]),
  address: z.string().min(1),
  province: z.string().min(1),
  city: z.string().min(1),
  sku: z.string().min(1),
  replacementSku: z.string().optional(),
  quantity: z.number().int().positive(),
  productDescription: z.string().min(1),
  failureDescription: z.string().min(1),
  nextAction: z.string().default(""),
  observations: z.string().default(""),
  origin: z.enum(["Kingston email", "Operations load", "Commercial handoff"]),
  banking: z
    .object({
      bankName: z.string().optional(),
      accountHolder: z.string().optional(),
      cuit: z.string().optional(),
      cbu: z.string().optional(),
      alias: z.string().optional(),
      accountNumber: z.string().optional()
    })
    .optional(),
  attachments: z.array(attachmentSchema).optional()
});

export async function GET(request: Request) {
  const unauthorizedResponse = authorizeAutomationRequest(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const url = new URL(request.url);
    const filters = {
      q: url.searchParams.get("q") ?? undefined,
      internalNumber: url.searchParams.get("internalNumber") ?? undefined,
      kingstonNumber: url.searchParams.get("kingstonNumber") ?? undefined,
      clientName: url.searchParams.get("clientName") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      zone: url.searchParams.get("zone") ?? undefined,
      includeArchived: parseBooleanParam(url.searchParams.get("includeArchived")),
      reimbursementState: url.searchParams.get("reimbursementState") ?? undefined,
      queue: url.searchParams.get("queue") ?? undefined,
      updatedSince: url.searchParams.get("updatedSince") ?? undefined
    };

    if (filters.status && !automationStatusValues.includes(filters.status as never)) {
      return NextResponse.json({ message: "El filtro status no es valido." }, { status: 400 });
    }

    if (filters.zone && !automationZoneValues.includes(filters.zone as never)) {
      return NextResponse.json({ message: "El filtro zone no es valido." }, { status: 400 });
    }

    if (filters.reimbursementState && !automationReimbursementValues.includes(filters.reimbursementState as never)) {
      return NextResponse.json({ message: "El filtro reimbursementState no es valido." }, { status: 400 });
    }

    if (filters.queue && !automationQueueValues.includes(filters.queue as never)) {
      return NextResponse.json({ message: "El filtro queue no es valido." }, { status: 400 });
    }

    const cases = await listAutomationCases(filters as AutomationCaseFilters);

    return NextResponse.json({
      count: cases.length,
      items: cases
    });
  } catch (error) {
    return automationErrorResponse(error, "No pude listar los casos para automatizacion.");
  }
}

export async function POST(request: Request) {
  const unauthorizedResponse = authorizeAutomationRequest(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const payload = createCaseSchema.parse(await request.json());
    const createdCase = await createAutomationCase(payload as CreateCaseInput);

    return NextResponse.json(
      {
        item: createdCase
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          message: "El payload para crear el caso no es valido.",
          issues: z.treeifyError(error)
        },
        { status: 400 }
      );
    }

    return automationErrorResponse(error, "No pude crear el caso desde automatizacion.");
  }
}
