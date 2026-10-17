import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Projetos" };

export default function ProjectsPage() {
  return (
    <PagePlaceholder
      title="Projetos"
      phase="Fase 1"
      description="Crie e gerencie seus livros: capítulos, progresso e retomada rápida de escrita."
    />
  );
}
