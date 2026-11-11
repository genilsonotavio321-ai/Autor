import type { Metadata } from "next";

import { ProjectDetailPage } from "@/features/projects/ui/project-detail-page";

export const metadata: Metadata = { title: "Projeto" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <ProjectDetailPage projectId={id} />;
}
