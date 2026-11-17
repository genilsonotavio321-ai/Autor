import type { Metadata } from "next";
import { Suspense } from "react";

import { ReadPage } from "@/features/read/ui/read-page";

export const metadata: Metadata = { title: "Ler" };

export default function Page() {
  return (
    <Suspense>
      <ReadPage />
    </Suspense>
  );
}
