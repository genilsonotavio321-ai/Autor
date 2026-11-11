"use client";

import Link from "next/link";
import { Database, FolderKanban, Frame, LayoutDashboard } from "lucide-react";

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
  const cards = (["projects", "dashboard", "canvas", "data"] as const).filter(
    (section) => homeSections.includes(section),
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 pt-2">
      <header className="space-y-2">
        <p className="text-[11px] font-medium tracking-[0.22em] text-muted-foreground uppercase">
          Seu ateliê de escrita
        </p>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">
          Início
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          Escolha por onde começar. As seções desta página podem ser
          personalizadas nas Configurações.
        </p>
      </header>

      {showSearch && (
        <section
          id="inicio-busca"
          aria-label="Buscar"
          className="rounded-2xl bg-card/70 p-4 ring-1 ring-border/70"
        >
          <SearchTool />
        </section>
      )}

      {homeSections.includes("continue") && <ResumeWritingCard />}

      {cards.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((section) => {
            const {
              title,
              description,
              href,
              icon: Icon,
            } = SECTION_CARDS[section];
            return (
              <Link
                key={section}
                href={href}
                className="group rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <div className="flex h-full flex-col gap-4 rounded-2xl bg-card/60 p-5 ring-1 ring-border/70 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:bg-accent/60 group-hover:ring-border">
                  <span className="flex size-9 items-center justify-center rounded-full bg-muted text-foreground/80">
                    <Icon aria-hidden className="size-4" />
                  </span>
                  <span className="space-y-1">
                    <span className="block font-serif text-lg font-semibold tracking-tight">
                      {title}
                    </span>
                    <span className="block text-sm leading-relaxed text-muted-foreground">
                      {description}
                    </span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {!showSearch &&
        cards.length === 0 &&
        !homeSections.includes("continue") && (
          <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Nenhuma seção selecionada. Escolha as seções em Configurações →
            Página inicial.
          </div>
        )}
    </div>
  );
}
