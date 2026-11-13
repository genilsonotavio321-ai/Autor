"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { Database, FolderKanban, Frame, LayoutDashboard } from "lucide-react";

import { EmptyState } from "@/components/layout/empty-state";
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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-9 pt-2">
      <header className="space-y-4">
        <p className="eyebrow">Seu ateliê de escrita</p>
        <h1 className="display-title">Início</h1>
        <p className="lead">
          Escolha por onde começar. As seções desta página podem ser
          personalizadas nas Configurações.
        </p>
        <div aria-hidden className="hairline" />
      </header>

      {showSearch && (
        <section
          id="inicio-busca"
          aria-label="Buscar"
          className="surface reveal p-4"
        >
          <SearchTool />
        </section>
      )}

      {homeSections.includes("continue") && <ResumeWritingCard />}

      {cards.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((section, index) => {
            const { title, description, href, icon: Icon } = SECTION_CARDS[section];
            return (
              <Link
                key={section}
                href={href}
                style={{ "--i": index } as CSSProperties}
                className="group reveal rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <div className="surface surface-lift flex h-full flex-col gap-4 p-5 group-hover:bg-card">
                  <div className="flex items-start justify-between">
                    <span className="grid size-10 place-items-center rounded-xl bg-muted/70 text-foreground/75 ring-1 ring-border/60">
                      <Icon aria-hidden className="size-[1.15rem]" />
                    </span>
                    <span
                      aria-hidden
                      className="text-muted-foreground/60 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none"
                    >
                      →
                    </span>
                  </div>
                  <span className="space-y-1.5">
                    <span className="block font-serif text-[1.3rem] leading-tight font-medium tracking-tight">
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

      {!showSearch && cards.length === 0 && !homeSections.includes("continue") && (
        <EmptyState
          icon={<LayoutDashboard aria-hidden className="size-5" />}
          title="Página em branco"
          hint="Nenhuma seção selecionada. Escolha as seções em Configurações → Página inicial."
        />
      )}
    </div>
  );
}
