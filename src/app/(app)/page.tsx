import type { Metadata } from "next";

import { HomePage } from "@/features/home/ui/home-page";

export const metadata: Metadata = { title: "Início" };

export default function Page() {
  return <HomePage />;
}
