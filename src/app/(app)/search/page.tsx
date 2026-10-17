import type { Metadata } from "next";

import { SearchPage } from "@/features/search/ui/search-page";

export const metadata: Metadata = {
  title: "Buscar",
};

export default function SearchRoute() {
  return <SearchPage />;
}
