import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Personagens" };

export default function CharactersPage() {
  return (
    <PagePlaceholder
      title="Personagens"
      phase="Fase 3"
      description="Fichas de personagens com motivações, medos, traços e relações."
    />
  );
}
