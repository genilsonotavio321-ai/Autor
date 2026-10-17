import type { Metadata } from "next";

import { CharactersPage } from "@/features/characters/ui/characters-page";

export const metadata: Metadata = { title: "Personagens" };

export default function CharactersRoutePage() {
  return <CharactersPage />;
}
