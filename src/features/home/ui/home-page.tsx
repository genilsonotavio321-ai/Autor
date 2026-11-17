"use client";

import { BookPlus, FilePlus2, Search } from "lucide-react";
import { useRouter } from "@/infra/navigation/use-app-router";
import { useState, type CSSProperties } from "react";

import { useUiStore } from "@/shared/store/ui-store";

import { NewChapterDialog } from "./new-chapter-dialog";

interface HomeAction {
  title: string;
  description: string;
  icon: typeof BookPlus;
  run: () => void;
}

/**
 * Página inicial enxuta: três portas de entrada para o acervo. O resto do app
 * vive na navegação; aqui a pessoa só escolhe por onde começar.
 */
export function HomePage() {
  const router = useRouter();
  const openSearch = useUiStore((state) => state.openSearch);
  const [newChapterOpen, setNewChapterOpen] = useState(false);

  const actions: HomeAction[] = [
    {
      title: "Nova história",
      description: "Criar um projeto do zero, com título e sinopse.",
      icon: BookPlus,
      run: () => router.push("/projects?novo=1"),
    },
    {
      title: "Novo capítulo",
      description: "Escolher um projeto existente e começar a escrever.",
      icon: FilePlus2,
      run: () => setNewChapterOpen(true),
    },
    {
      title: "Localizar arquivos",
      description: "Buscar capítulos, personagens, locais e notas.",
      icon: Search,
      run: openSearch,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-9 pt-2">
      <header className="space-y-4 text-center">
        <p className="eyebrow">Seu ateliê de escrita</p>
        <h1 className="display-title">Início</h1>
        <div aria-hidden className="hairline" />
      </header>

      <div className="grid gap-3">
        {actions.map((action, index) => (
          <button
            key={action.title}
            type="button"
            onClick={action.run}
            style={{ "--i": index } as CSSProperties}
            className="group reveal rounded-2xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="surface surface-lift flex items-center gap-4 p-5 group-hover:bg-card">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted/70 text-foreground/75 ring-1 ring-border/60">
                <action.icon aria-hidden className="size-[1.15rem]" />
              </span>
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block font-serif text-[1.25rem] leading-tight font-medium tracking-tight">
                  {action.title}
                </span>
                <span className="block text-sm leading-relaxed text-muted-foreground">
                  {action.description}
                </span>
              </span>
              <span
                aria-hidden
                className="text-muted-foreground/60 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none"
              >
                →
              </span>
            </span>
          </button>
        ))}
      </div>

      <NewChapterDialog
        open={newChapterOpen}
        onOpenChange={setNewChapterOpen}
      />
    </div>
  );
}
