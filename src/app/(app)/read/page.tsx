import type { Metadata } from "next";

import { ReadPage } from "@/features/read/ui/read-page";

export const metadata: Metadata = { title: "Ler" };

export default function Page() {
  return <ReadPage />;
}
