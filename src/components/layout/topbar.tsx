"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Search, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SprintTimer } from "@/features/productivity/ui/sprint-timer";
import { useUiStore } from "@/shared/store/ui-store";
import { BrandIcon } from "./nav-items";

/** Header mínimo: marca no celular, ações essenciais em ambos os tamanhos. */
export function Topbar() {
  const { resolvedTheme, setTheme } = useTheme();
  const openSearch = useUiStore((state) => state.openSearch);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <header
      style={{
        height: "calc(3.25rem + env(safe-area-inset-top))",
        paddingTop: "env(safe-area-inset-top)",
      }}
      className="sticky top-0 z-30 flex shrink-0 items-center gap-2 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 md:px-8"
    >
      <span className="flex items-center gap-2 md:hidden">
        <BrandIcon className="size-4 text-primary" aria-hidden="true" />
        <span className="font-serif text-[1.0625rem] font-medium tracking-tight">
          Autor
        </span>
      </span>

      <div className="ml-auto flex items-center gap-1">
        <div className="hidden md:flex md:items-center md:gap-1.5">
          <SprintTimer compact />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={openSearch}
          aria-label="Abrir busca"
        >
          <Search aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
        >
          {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </Button>
      </div>
    </header>
  );
}
