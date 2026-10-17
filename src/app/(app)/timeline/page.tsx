import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Linha do tempo" };

export default function TimelinePage() {
  return (
    <PagePlaceholder
      title="Linha do tempo"
      phase="Fase 2"
      description="Cronologia dos eventos da história com datas ordenáveis e vínculos."
    />
  );
}
