import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Estrutura" };

export default function OutlinePage() {
  return (
    <PagePlaceholder
      title="Estrutura"
      phase="Fase 2"
      description="Esboço do livro com arrastar-e-soltar, planilhas de beats, quadro de cortiça e kanban."
    />
  );
}
