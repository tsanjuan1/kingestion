import { Suspense } from "react";

import { CaseDetailModule } from "@/components/workspace/case-detail-module";

export default function CaseDetailPage() {
  return (
    <Suspense fallback={<div className="workspace-page">Cargando caso...</div>}>
      <CaseDetailModule />
    </Suspense>
  );
}
