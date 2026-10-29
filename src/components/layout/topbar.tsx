"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Menu, Moon, Search, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SprintTimer } from "@/features/productivity/ui/sprint-timer";
import { useUiStore } from "@/shared/store/ui-store";

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const openSearch = useUiStore((state) => state.openSearch);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <header
      // Tela cheia no iPhone (viewport-fit=cover): a barra desenha sob o
      // status bar e empurra o conteúdo com env(safe-area-inset-top).
      style={{
        height: "calc(3.5rem + env(safe-area-inset-top))",
        paddingTop: "env(safe-area-inset-top)",
      }}
      className="sticky top-0 z-30 flex shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-4"
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        aria-label="Alternar menu de navegação"
      >
        <Menu aria-hidden="true" />
      </Button>

      <span className="font-heading text-sm font-semibold md:hidden">
        Autor
      </span>

      <div className="ml-auto flex items-center gap-1.5">
        {/* Buscar, sprint e tema agora vivem no menu do app (MobileNav) no
            celular — a topbar mobile mantém só o menu e o título. */}
        <div className="hidden md:flex md:items-center md:gap-1.5">
          <SprintTimer compact />
          <Button
            variant="outline"
            size="sm"
            className="text-muted-foreground"
            onClick={openSearch}
          >
            <Search aria-hidden="true" />
            <span>Buscar</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
          >
            {isDark ? (
              <Sun aria-hidden="true" />
            ) : (
              <Moon aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
