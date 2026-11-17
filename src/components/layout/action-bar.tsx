"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { chapterRepository } from "@/features/projects/infra/dexie-chapter-repository";
import { projectRepository } from "@/features/projects/infra/dexie-project-repository";
import { ProjectPicker } from "@/features/projects/ui/project-picker";
import { useRouter } from "@/infra/navigation/use-app-router";
import { useUiStore } from "@/shared/store/ui-store";

import { BrandIcon, mobileTabs, navGroups } from "./nav-items";

interface ActionBarContextValue {
  slot: HTMLDivElement | null;
  setSlot: (node: HTMLDivElement | null) => void;
  register: () => () => void;
  actionCount: number;
}

const ActionBarContext = createContext<ActionBarContextValue | null>(null);

/**
 * Barra flutuante única do app. No celular carrega a navegação rápida; em
 * ambos os tamanhos as páginas injetam suas ações pelo `PageActionBar`.
 */
export function ActionBarProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const [actionCount, setActionCount] = useState(0);

  const register = useCallback(() => {
    setActionCount((count) => count + 1);
    return () => setActionCount((count) => Math.max(0, count - 1));
  }, []);

  const value = useMemo(
    () => ({ slot, setSlot, register, actionCount }),
    [slot, register, actionCount],
  );

  return (
    <ActionBarContext.Provider value={value}>{children}</ActionBarContext.Provider>
  );
}

/** Ações da página atual, renderizadas dentro da barra flutuante. */
export function PageActionBar({ children }: { children: ReactNode }) {
  const context = useContext(ActionBarContext);
  const register = context?.register;

  useEffect(() => {
    if (!register) return;
    return register();
  }, [register]);

  if (!context?.slot) return null;
  return createPortal(
    <div className="flex items-center gap-1">{children}</div>,
    context.slot,
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/projects") {
    return pathname.startsWith("/projects") || pathname.startsWith("/write");
  }
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function ActionBar() {
  const pathname = usePathname();
  const router = useRouter();
  const slotRef = useContext(ActionBarContext);
  const [moreOpen, setMoreOpen] = useState(false);
  const panelTabVisible = useUiStore((state) => state.panelTabVisible);
  const openSearch = useUiStore((state) => state.openSearch);
  const selectedProjectId = useUiStore((state) => state.selectedProjectId);

  useEffect(() => setMoreOpen(false), [pathname]);

  // O menu expandido lista o acervo e o sistema. Atalhos que já vivem na
  // barra inferior (ou em outras telas) saem daqui; os arquivados do app
  // continuam acessíveis pela busca.
  const moreItems = navGroups
    .flatMap((group) => group.items)
    .filter(
      (item) =>
        !["/", "/canvas", "/read", "/world", "/characters", "/notes"].includes(
          item.href,
        ),
    )
    .filter(
      (item) =>
        item.href === "/dashboard" ||
        panelTabVisible ||
        item.optional !== true,
    );

  /** "Escrever" abre o último capítulo editado do projeto selecionado. */
  async function openWriting() {
    if (selectedProjectId) {
      const project = await projectRepository.getById(selectedProjectId);
      const chapterId = project?.lastEdit?.chapterId;
      if (chapterId) {
        const chapter = await chapterRepository.getById(chapterId);
        if (chapter && !chapter.deletedAt && !chapter.archived) {
          router.push(`/write/${chapter.id}`);
          return;
        }
      }
    }
    router.push("/projects");
  }

  const hasActions = (slotRef?.actionCount ?? 0) > 0;

  return (
    <>
      <nav
        aria-label="Navegação principal"
        data-slot="app-action-bar"
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 flex flex-col items-center gap-2 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          // Sem ações no desktop a barra inteira desaparece.
          !hasActions && "md:hidden",
        )}
      >
        {/* Sub-barra superior: só as ações da página atual. */}
        <div
          ref={slotRef?.setSlot}
          className={cn(
            "items-center gap-1 rounded-full border border-border/80 bg-background/90 px-2 py-1.5 shadow-lg backdrop-blur-xl",
            hasActions ? "flex" : "hidden",
          )}
        />

        <div className="flex max-w-full items-center gap-1 rounded-full border border-border/80 bg-background/90 px-2 py-1.5 shadow-lg backdrop-blur-xl md:hidden">
          <ul className="flex items-stretch gap-1">
            {mobileTabs.map((tab) => {
              const active = isActive(pathname, tab.href);
              const content = (
                <span
                  className={cn(
                    "flex h-11 min-w-14 flex-col items-center justify-center gap-0.5 rounded-full px-2 text-[10px] tracking-wide transition-colors",
                    active
                      ? "bg-accent font-semibold text-foreground"
                      : "font-medium text-muted-foreground hover:text-foreground",
                  )}
                >
                  <tab.icon
                    className={cn("size-5", active ? "opacity-100" : "opacity-70")}
                    aria-hidden="true"
                  />
                  {tab.title}
                </span>
              );
              return (
                <li key={tab.href}>
                  {tab.href === "/projects" ? (
                    <button
                      type="button"
                      aria-current={active ? "page" : undefined}
                      onClick={() => void openWriting()}
                    >
                      {content}
                    </button>
                  ) : (
                    <Link
                      href={tab.href}
                      aria-current={active ? "page" : undefined}
                    >
                      {content}
                    </Link>
                  )}
                </li>
              );
            })}
            <li>
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                aria-label="Abrir mais seções"
                className="flex h-11 min-w-14 flex-col items-center justify-center gap-0.5 rounded-full px-2 text-[10px] font-medium tracking-wide text-muted-foreground transition-colors hover:text-foreground"
              >
                <Menu className="size-5 opacity-70" aria-hidden="true" />
                Mais
              </button>
            </li>
          </ul>

        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[86svh] rounded-t-3xl pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-4 text-center">
            {/* Espaçadores iguais dos dois lados: o título fica no centro real,
                mesmo com o botão de fechar ocupando a direita. */}
            <span aria-hidden className="size-8" />
            <span className="flex items-center justify-center gap-2">
              <BrandIcon className="size-5 text-primary" aria-hidden="true" />
              <SheetTitle className="font-serif text-lg">Autor</SheetTitle>
            </span>
            <span aria-hidden className="size-8" />
            <SheetDescription className="sr-only">
              Todas as seções e controles do app
            </SheetDescription>
          </SheetHeader>

          <div className="mx-auto w-full max-w-lg overflow-y-auto px-4 pb-6">
            <div className="mb-4">
              <ProjectPicker />
            </div>

            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              {moreItems.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-3 text-sm outline-none transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground/75 hover:bg-accent/70 hover:text-foreground",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.title}</span>
                  </Link>
                );
              })}
            </div>

            <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
              <Button
                variant="outline"
                size="icon"
                aria-label="Abrir a busca"
                onClick={() => {
                  setMoreOpen(false);
                  openSearch();
                }}
              >
                <Search aria-hidden="true" />
              </Button>
              <span className="text-xs text-muted-foreground">
                O tema fica em Configurações.
              </span>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
