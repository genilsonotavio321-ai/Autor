import type { Metadata } from "next";

import { EditorPage } from "@/features/editor/ui/editor-page";

export const metadata: Metadata = { title: "Escrever" };

interface PageProps {
  params: Promise<{ chapterId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { chapterId } = await params;
  return <EditorPage chapterId={chapterId} />;
}
