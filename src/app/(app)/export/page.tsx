import type { Metadata } from "next";

import { ExportPage } from "@/features/export/ui/export-page";

export const metadata: Metadata = {
  title: "Exportar",
};

export default function ExportRoute() {
  return <ExportPage />;
}
