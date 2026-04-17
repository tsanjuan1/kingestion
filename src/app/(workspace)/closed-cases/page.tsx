import { Suspense } from "react";

import { CasesModule } from "@/components/workspace/cases-module";

export default function ClosedCasesPage() {
  return (
    <Suspense fallback={<div className="workspace-page">Cargando casos...</div>}>
      <CasesModule mode="closed" />
    </Suspense>
  );
}
