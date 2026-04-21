import { Suspense } from "react";

import { DashboardModule } from "@/components/workspace/dashboard-module";

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="workspace-page">Cargando resumen...</div>}>
      <DashboardModule />
    </Suspense>
  );
}
