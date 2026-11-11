import type { Metadata } from "next";

import { TimelinePage } from "@/features/plot/ui/timeline-page";

export const metadata: Metadata = { title: "Linha do tempo" };

export default function Page() {
  return <TimelinePage />;
}
