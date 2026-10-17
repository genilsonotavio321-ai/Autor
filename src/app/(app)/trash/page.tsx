import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Lixeira" };

export default function TrashPage() {
  return (
    <PagePlaceholder
      title="Lixeira"
      phase="Fase 1"
      description="Itens excluídos ficam aqui: restaure ou apague definitivamente."
    />
  );
}
