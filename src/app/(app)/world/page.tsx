import type { Metadata } from "next";

import { WorldPage } from "@/features/world/ui/world-page";

export const metadata: Metadata = { title: "Mundo" };

export default function WorldRoutePage() {
  return <WorldPage />;
}
