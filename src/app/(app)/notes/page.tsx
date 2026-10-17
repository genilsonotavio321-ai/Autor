import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Notas" };

export default function NotesPage() {
  return (
    <PagePlaceholder
      title="Notas"
      phase="Fase 2"
      description="Notas rápidas fixáveis para ideias, pesquisa e lembretes da escrita."
    />
  );
}
