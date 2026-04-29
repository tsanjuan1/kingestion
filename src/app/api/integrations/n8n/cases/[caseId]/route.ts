import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizeAutomationRequest, automationErrorResponse } from "@/app/api/integrations/n8n/_lib";
import {
  automationAvailabilityValues,
  automationReimbursementValues,
  automationStatusValues
} from "@/lib/kingston/automation";
import { getAutomationCase, patchAutomationCase } from "@/lib/kingston/server";
import type { AutomationCasePatch } from "@/lib/kingston/server";

const nullableTrimmedString = z.string().optional().nullable();

const attachmentSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["mail", "photo", "proof", "guide", "form"]).optional(),
  sizeLabel: z.string().min(1),
  mimeType: z.string().optional(),
  previewUrl: z.string().optional()
});

const logisticsPatchSchema = z.object({
  mode: z.enum(["Dispatch", "Pickup"]).optional(),
  address: z.string().min(1).optional(),
  transporter: nullableTrimmedString,
  guideNumber: nullableTrimmedString,
  trackingUrl: nullableTrimmedString,
  dispatchDate: nullableTrimmedString,
  deliveredDate: nullableTrimmedString,
  shippingCost: nullableTrimmedString,
  reimbursementState: z
    .string()
    .refine((value) => automationReimbursementValues.includes(value as never), {
      message: "Estado de reintegro invalido."
    })
    .optional()
});

const procurementPatchSchema = z.object({
  localStock: z
    .string()
    .refine((value) => automationAvailabilityValues.includes(value as never), {
      message: "localStock invalido."
    })
    .optional(),
  wholesalerStock: z
    .string()
    .refine((value) => automationAvailabilityValues.includes(value as never), {
      message: "wholesalerStock invalido."
    })
    .optional(),
  wholesalerName: nullableTrimmedString,
  requiresKingstonOrder: z.boolean().optional(),
  kingstonRequestedAt: nullableTrimmedString,
  receivedFromUsaAt: nullableTrimmedString,
  releasedByPurchasing: z.boolean().optional(),
  releasedAt: nullableTrimmedString,
  movedToRmaWarehouse: z.boolean().optional(),
  movedToRmaWarehouseAt: nullableTrimmedString
});

const patchCaseSchema = z
  .object({
    owner: z.string().min(1).optional(),
    status: z
      .string()
      .refine((value) => automationStatusValues.includes(value as never), {
        message: "Estado externo invalido."
      })
      .optional(),
    replacementSku: nullableTrimmedString,
    comment: z
      .object({
        body: z.string().min(1),
        internal: z.boolean().optional()
      })
      .optional(),
    attachment: attachmentSchema.optional(),
    logistics: logisticsPatchSchema.optional(),
    procurement: procurementPatchSchema.optional(),
    completeReimbursement: z.boolean().optional(),
    completeQueueStep: z.boolean().optional(),
    archive: z.boolean().optional(),
    restore: z.boolean().optional()
  })
  .refine(
    (payload) =>
      payload.owner !== undefined ||
      payload.status !== undefined ||
      payload.replacementSku !== undefined ||
      payload.comment !== undefined ||
      payload.attachment !== undefined ||
      payload.logistics !== undefined ||
      payload.procurement !== undefined ||
      payload.completeReimbursement === true ||
      payload.completeQueueStep === true ||
      payload.archive === true ||
      payload.restore === true,
    {
      message: "El payload de actualizacion no contiene cambios."
    }
  );

export async function GET(request: Request, context: { params: Promise<{ caseId: string }> }) {
  const unauthorizedResponse = authorizeAutomationRequest(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const { caseId } = await context.params;
    const entry = await getAutomationCase(caseId);

    if (!entry) {
      return NextResponse.json({ message: "No pude encontrar el caso solicitado." }, { status: 404 });
    }

    return NextResponse.json({ item: entry });
  } catch (error) {
    return automationErrorResponse(error, "No pude recuperar el caso para automatizacion.");
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ caseId: string }> }) {
  const unauthorizedResponse = authorizeAutomationRequest(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const { caseId } = await context.params;
    const payload = patchCaseSchema.parse(await request.json());
    const updatedCase = await patchAutomationCase(caseId, payload as AutomationCasePatch);

    if (!updatedCase) {
      return NextResponse.json({ message: "No pude encontrar el caso solicitado." }, { status: 404 });
    }

    return NextResponse.json({ item: updatedCase });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          message: "El payload para actualizar el caso no es valido.",
          issues: z.treeifyError(error)
        },
        { status: 400 }
      );
    }

    return automationErrorResponse(error, "No pude actualizar el caso desde automatizacion.");
  }
}
