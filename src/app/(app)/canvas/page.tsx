import type { Metadata } from "next";

import { CreativityPage } from "@/features/creativity/ui/creativity-page";

export const metadata: Metadata = { title: "Canvas" };

export default function Page() {
  return <CreativityPage defaultTab="canvas" />;
}
