import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Ler" };

export default function ReadPage() {
  return (
    <PagePlaceholder
      title="Ler"
      phase="Fase 1"
      description="Modo de leitura do seu manuscrito, pronto para revisão confortável."
    />
  );
}
