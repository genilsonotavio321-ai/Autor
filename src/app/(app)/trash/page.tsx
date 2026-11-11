import type { Metadata } from "next";

import { TrashPage } from "@/features/projects/ui/trash-page";

export const metadata: Metadata = { title: "Lixeira" };

export default function Page() {
  return <TrashPage />;
}
