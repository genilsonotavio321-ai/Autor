"use client";

import Link from "next/link";
import { Database, FolderKanban, Frame, LayoutDashboard } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SearchTool } from "@/features/search/ui/search-tool";
import { ResumeWritingCard } from "@/features/projects/ui/resume-writing-card";
import { useUiStore, type HomeSection } from "@/shared/store/ui-store";

const SECTION_CARDS: Record<
  Exclude<HomeSection, "search" | "continue">,
  { title: string; description: string; href: string; icon: typeof Database }
> = {
  projects: {
    title: "Projetos",
    description: "Ver e criar seus projetos de escrita.",
    href: "/projects",
    icon: FolderKanban,
  },
  dashboard: {
    title: "Painel",
    description: "Estatísticas e progresso dos seus projetos.",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  canvas: {
    title: "Canvas",
    description: "Quadro de ideias do projeto.",
    href: "/canvas",
    icon: Frame,
  },
  data: {
    title: "Dados",
    description: "Exportar, importar e fazer backup.",
    href: "/settings?tab=dados",
    icon: Database,
  },
};

export function HomePage() {
  const homeSections = useUiStore((state) => state.homeSections);
  const showSearch = homeSections.includes("search");
  const cards = (
    ["projects", "dashboard", "canvas", "data"] as const
  ).filter((section) => homeSections.includes(section));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl font-semibold">Início</h1>
        <p className="text-muted-foreground">
          Escolha por onde começar. As seções desta página podem ser
          personalizadas nas Configurações.
        </p>
      </header>

      {showSearch && (
        <Card id="inicio-busca">
          <CardHeader>
            <CardTitle>Buscar</CardTitle>
            <CardDescription>
              Procure capítulos, personagens, locais, notas e seções do app.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SearchTool />
          </CardContent>
        </Card>
      )}

      {homeSections.includes("continue") && <ResumeWritingCard />}

      {cards.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map((section) => {
            const { title, description, href, icon: Icon } = SECTION_CARDS[section];
            return (
              <Link key={section} href={href} className="rounded-xl">
                <Card className="h-full transition-colors hover:bg-accent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Icon aria-hidden className="size-4" />
                      {title}
                    </CardTitle>
                    <CardDescription>{description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {!showSearch &&
        cards.length === 0 &&
        !homeSections.includes("continue") && (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Nenhuma seção selecionada. Escolha as seções em Configurações →
          Página inicial.
        </div>
      )}
    </div>
  );
}
