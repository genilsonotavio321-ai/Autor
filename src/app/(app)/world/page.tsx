import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Mundo" };

export default function WorldPage() {
  return (
    <PagePlaceholder
      title="Mundo"
      phase="Fase 3"
      description="Locais e lore do universo da sua história, tudo ligado aos capítulos."
    />
  );
}
