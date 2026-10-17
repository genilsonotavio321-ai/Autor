"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";

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
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const toggleFocusMode = useUiStore((state) => state.toggleFocusMode);

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
