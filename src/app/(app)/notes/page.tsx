import type { Metadata } from "next";

import { NotesPage } from "@/features/notes/ui/notes-page";

export const metadata: Metadata = { title: "Notas" };

export default function Page() {
  return <NotesPage />;
}
