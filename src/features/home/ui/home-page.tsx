"use client";

import { BookPlus, FilePlus2, Search } from "lucide-react";
import { useRouter } from "@/infra/navigation/use-app-router";
import { useState } from "react";

import { useUiStore } from "@/shared/store/ui-store";

import { NewChapterDialog } from "./new-chapter-dialog";

interface HomeAction {
  title: string;
  icon: typeof BookPlus;
  run: () => void;
}

/**
 * Página inicial enxuta: três portas de entrada para o acervo, em ícones
 * pequenos e centrados. Só o texto do topo explica o que fazer aqui.
 */
export function HomePage() {
  const router = useRouter();
  const openSearch = useUiStore((state) => state.openSearch);
  const [newChapterOpen, setNewChapterOpen] = useState(false);

  const actions: HomeAction[] = [
    {
      title: "Nova história",
      icon: BookPlus,
      run: () => router.push("/projects?novo=1"),
    },
    {
      title: "Novo capítulo",
      icon: FilePlus2,
      run: () => setNewChapterOpen(true),
    },
    {
      title: "Localizar arquivos",
      icon: Search,
      run: openSearch,
    },
  ];

  return (
    <div className="flex min-h-[calc(100dvh-13rem)] w-full flex-col items-center justify-center gap-5 text-center">
      <p className="text-sm text-muted-foreground">O que você quer fazer?</p>

      <div className="flex flex-col items-center justify-center gap-2">
        {actions.map((action) => (
          <button
            key={action.title}
            type="button"
            onClick={action.run}
            className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3.5 py-2 text-sm font-medium text-foreground/80 outline-none transition-colors hover:bg-card hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <action.icon aria-hidden className="size-4 shrink-0 opacity-80" />
            {action.title}
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
