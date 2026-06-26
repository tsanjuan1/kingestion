import { after, NextResponse } from "next/server";

import {
  sendCaseStatusNotificationFromKingestion,
  sendReimbursementCompletedNotificationFromKingestion,
  sendReimbursementMissingDataRequestFromKingestion
} from "@/lib/kingston/native-automation";
import type { WorkspaceMutation } from "@/lib/kingston/server";
import { applyWorkspaceMutation, assertRateLimit, getAuthSessionUser } from "@/lib/kingston/server";
import { assertSameOriginRequest, getRequestClientKey } from "@/lib/request-security";

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Origen no permitido." }, { status: 403 });
  }

  const currentUser = await getAuthSessionUser();

  if (!currentUser) {
    return NextResponse.json({ message: "Sesion vencida." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  try {
    await assertRateLimit("workspace-mutate", `${currentUser.id}|${getRequestClientKey(request)}`, 240, 10 * 60 * 1000);
    const mutation = (await request.json()) as WorkspaceMutation;
    const result = await applyWorkspaceMutation(currentUser.id, mutation);
    if (mutation.type === "updateCaseStatus" || mutation.type === "completeQueueStep") {
      after(() => {
        void sendCaseStatusNotificationFromKingestion(
          mutation.caseId,
          mutation.type === "updateCaseStatus" ? mutation.status : mutation.nextStatus
        ).catch((error) => {
          console.error("No pude enviar el aviso automatico de cambio de estado.", error);
        });
      });
    }
    if (mutation.type === "completeReimbursement") {
      after(() => {
        void sendReimbursementCompletedNotificationFromKingestion(mutation.caseId).catch((error) => {
          console.error("No pude enviar el aviso automatico de reintegro completado.", error);
        });
      });
    }
    if (mutation.type === "requestReimbursementMissingData") {
      after(() => {
        void sendReimbursementMissingDataRequestFromKingestion(mutation.caseId).catch((error) => {
          console.error("No pude enviar la solicitud automatica de datos faltantes.", error);
        });
      });
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pude aplicar el cambio solicitado.";
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    return NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
