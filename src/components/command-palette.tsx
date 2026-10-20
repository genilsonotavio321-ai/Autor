"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Search as SearchIcon } from "lucide-react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { navGroups } from "@/components/layout/nav-items";
import { playUiSound } from "@/shared/lib/sound";
import { useUiStore } from "@/shared/store/ui-store";

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const open = useUiStore((state) => state.commandPaletteOpen);
  const openCommandPalette = useUiStore((state) => state.openCommandPalette);
  const closeCommandPalette = useUiStore((state) => state.closeCommandPalette);
  const toggleCommandPalette = useUiStore(
    (state) => state.toggleCommandPalette,
  );
  const openSearch = useUiStore((state) => state.openSearch);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const toggleFocusMode = useUiStore((state) => state.toggleFocusMode);

  // Ctrl+K e botões mudam o estado direto; Radix não emite onOpenChange.
  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current === open) return;
    prevOpen.current = open;
    playUiSound(open ? "open" : "close");
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggleCommandPalette();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleCommandPalette]);

  // Re-navigating to the same route is a no-op; close the palette anyway.
  const navigate = (href: string) => {
    if (href !== pathname) router.push(href);
    closeCommandPalette();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={(nextOpen) => (nextOpen ? openCommandPalette() : closeCommandPalette())}
      title="Paleta de comandos"
      description="Navegue entre as páginas e execute ações do Autor"
    >
      <Command>
        <CommandInput placeholder="Digite uma página ou ação..." />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          <CommandGroup heading="Navegação">
            <CommandItem
              value="Buscar no acervo popup"
              onSelect={() => {
                closeCommandPalette();
                openSearch();
              }}
            >
              <SearchIcon aria-hidden="true" />
              <span>Buscar no acervo</span>
            </CommandItem>
            {navGroups.flatMap((group) =>
              group.items.map((item) => (
                <CommandItem
                  key={item.href}
                  value={`${item.title} ${item.href}`}
                  onSelect={() => navigate(item.href)}
                >
                  <item.icon aria-hidden="true" />
                  <span>{item.title}</span>
                </CommandItem>
              )),
            )}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Ações">
            <CommandItem
              onSelect={() => {
                setTheme(resolvedTheme === "dark" ? "light" : "dark");
                closeCommandPalette();
              }}
            >
              Alternar tema claro/escuro
            </CommandItem>
            <CommandItem
              onSelect={() => {
                toggleSidebar();
                closeCommandPalette();
              }}
            >
              Alternar barra lateral
            </CommandItem>
            <CommandItem
              onSelect={() => {
                toggleFocusMode();
                closeCommandPalette();
              }}
            >
              Alternar modo foco
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
