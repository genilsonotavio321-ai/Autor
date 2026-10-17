import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Configurações" };

export default function SettingsPage() {
  return (
    <PagePlaceholder
      title="Configurações"
      phase="Fase 5"
      description="Preferências do app: personalização, atalhos, tags e dados."
    />
  );
}
