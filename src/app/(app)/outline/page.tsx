import type { Metadata } from "next";

import { OutlinePage } from "@/features/plot/ui/outline-page";

export const metadata: Metadata = { title: "Estrutura" };

export default function Page() {
  return <OutlinePage />;
}
