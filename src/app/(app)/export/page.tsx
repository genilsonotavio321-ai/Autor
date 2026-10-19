import type { Metadata } from "next";

import { ExportPage } from "@/features/export/ui/export-page";

export const metadata: Metadata = {
  title: "Dados",
};

export default function ExportRoute() {
  return <ExportPage />;
}
