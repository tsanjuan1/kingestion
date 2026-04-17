import { Suspense } from "react";

import { ReportsModule } from "@/components/workspace/reports-module";

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="workspace-page">Cargando reportes...</div>}>
      <ReportsModule />
    </Suspense>
  );
}
