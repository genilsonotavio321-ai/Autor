import type { Metadata } from "next";

import { DashboardPage } from "@/features/projects/ui/dashboard-page";

export const metadata: Metadata = { title: "Painel" };

export default function Page() {
  return <DashboardPage />;
}
