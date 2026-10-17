import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Exportar" };

export default function ExportPage() {
  return (
    <PagePlaceholder
      title="Exportar"
      phase="Fase 4"
      description="Exporte o manuscrito em Markdown, DOCX, PDF e EPUB, com importação e backup."
    />
  );
}
