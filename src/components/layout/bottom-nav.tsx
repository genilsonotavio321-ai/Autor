"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Menu, Moon, Search, Sun } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ProjectPicker } from "@/features/projects/ui/project-picker";
import { SprintTimer } from "@/features/productivity/ui/sprint-timer";
import { useUiStore } from "@/shared/store/ui-store";
import { BrandIcon, mobileTabs, navGroups } from "./nav-items";

function isActive(pathname: string, href: string): boolean {
  if (href === "/projects") {
    // A aba "Escrever" também cobre o editor e o detalhe do projeto.
    return pathname.startsWith("/projects") || pathname.startsWith("/write");
  }
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const panelTabVisible = useUiStore((state) => state.panelTabVisible);
  const openSearch = useUiStore((state) => state.openSearch);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => setMoreOpen(false), [pathname]);
  const isDark = mounted && resolvedTheme === "dark";

  const moreItems = navGroups.flatMap((group) =>
    group.items.filter((item) => panelTabVisible || item.optional !== true),
  );

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <ul className="mx-auto flex h-14 max-w-lg items-stretch">
          {mobileTabs.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-full flex-col items-center justify-center gap-0.5 text-[11px] tracking-wide outline-none transition-colors",
                    active
                      ? "font-semibold text-foreground after:absolute after:inset-x-6 after:top-0 after:h-0.5 after:rounded-b-full after:bg-primary"
                      : "font-medium text-muted-foreground hover:text-foreground",
                  )}
                >
                  <tab.icon
                    className={cn("size-5", active ? "opacity-100" : "opacity-70")}
                    aria-hidden="true"
                  />
                  {tab.title}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-label="Abrir mais opções"
              className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium tracking-wide text-muted-foreground outline-none transition-colors hover:text-foreground"
            >
              <Menu className="size-5 opacity-70" aria-hidden="true" />
              Mais
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[86svh] rounded-t-3xl pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader className="flex-row items-center gap-2 text-left">
            <BrandIcon className="size-5 text-primary" aria-hidden="true" />
            <SheetTitle className="font-serif text-lg">Autor</SheetTitle>
            <SheetDescription className="sr-only">
              Todas as seções e controles do app
            </SheetDescription>
          </SheetHeader>

          <div className="overflow-y-auto px-4 pb-6">
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
              <SprintTimer compact />
              <span className="min-w-0 flex-1" />
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
              <Button
                variant="outline"
                size="icon"
                aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
                onClick={() => setTheme(isDark ? "light" : "dark")}
              >
                {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
