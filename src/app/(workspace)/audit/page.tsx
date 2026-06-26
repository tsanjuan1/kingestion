import { Suspense } from "react";

import { AuditModule } from "@/components/workspace/audit-module";

export default function AuditPage() {
  return (
    <Suspense fallback={<div className="workspace-page">Cargando auditoria...</div>}>
      <AuditModule />
    </Suspense>
  );
}
