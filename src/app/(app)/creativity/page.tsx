import type { Metadata } from "next";

import { CreativityPage } from "@/features/creativity/ui/creativity-page";

export const metadata: Metadata = { title: "Criatividade" };

export default function Page() {
  return <CreativityPage />;
}
