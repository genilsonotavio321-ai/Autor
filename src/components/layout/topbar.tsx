"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Menu, Moon, Search, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        aria-label="Alternar menu de navegação"
      >
        <Menu aria-hidden="true" />
      </Button>

      <span className="font-heading text-sm font-semibold md:hidden">Autor</span>

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="hidden text-muted-foreground md:flex"
          asChild
        >
          <Link href="/search">
            <Search aria-hidden="true" />
            <span>Buscar</span>
          </Link>
        </Button>
        <Button variant="ghost" size="icon" asChild className="md:hidden">
          <Link href="/search" aria-label="Ir para a busca">
            <Search aria-hidden="true" />
          </Link>
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
    </header>
  );
}
