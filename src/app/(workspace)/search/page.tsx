import { Suspense } from "react";

import { SearchModule } from "@/components/workspace/search-module";

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="workspace-page">Cargando busqueda...</div>}>
      <SearchModule />
    </Suspense>
  );
}
