import { Suspense } from "react";

import { SettingsModule } from "@/components/workspace/settings-module";

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="workspace-page">Cargando configuracion...</div>}>
      <SettingsModule />
    </Suspense>
  );
}
