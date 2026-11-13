"use client";

import { useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { CommandPalette } from "@/components/command-palette";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { SearchDialog } from "@/features/search/ui/search-dialog";
import { NotificationMonitor } from "@/features/productivity/ui/notification-monitor";
import { SprintTicker } from "@/features/productivity/ui/sprint-ticker";
import { SprintTimer } from "@/features/productivity/ui/sprint-timer";
import { TrashAutoPurge } from "@/features/projects/ui/trash-auto-purge";
import { useUiStore } from "@/shared/store/ui-store";

// Variante de tema (Papel, Marfim, Névoa, Tinta, Grafite, Meia-noite):
// next-themes só escreve light/dark; a variante vira atributo no <html>
// consumido pelo globals.css.
function useThemeVariantAttribute() {
  const themeVariantLight = useUiStore((state) => state.themeVariantLight);
  const themeVariantDark = useUiStore((state) => state.themeVariantDark);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const variant =
      resolvedTheme === "dark" ? themeVariantDark : themeVariantLight;
    document.documentElement.setAttribute("data-theme-variant", variant);
  }, [resolvedTheme, themeVariantLight, themeVariantDark]);
}

// Toggle "Desativar animações" de Configurações → atributo no <html>.
// O CSS global desliga transitions/animations quando data-animations="off".
function useAnimationPreference() {
  const enabled = useUiStore((state) => state.animationsEnabled);
  useEffect(() => {
    document.documentElement.dataset.animations = enabled ? "on" : "off";
  }, [enabled]);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const focusMode = useUiStore((state) => state.focusMode);
  const sprintRunning = useUiStore((state) => state.sprintRunning);
  const pathname = usePathname();

  useThemeVariantAttribute();
  useAnimationPreference();

  const skipLink = (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:border focus:bg-background focus:px-3 focus:py-2 focus:shadow-md"
    >
      Pular para o conteúdo
    </a>
  );

  // Serviços persistentes do shell: expiração da lixeira e notificações.
  const backgroundServices = (
    <>
      <TrashAutoPurge />
      <NotificationMonitor />
    </>
  );

  // Focus mode: some com todo o chrome, sobra só a superfície de escrita.
  if (focusMode) {
    return (
      <div className="min-h-dvh w-full">
        {backgroundServices}
        <SearchDialog />
        <SprintTicker />
        {skipLink}
        {sprintRunning && !pathname.startsWith("/write") ? (
          <div
            data-slot="app-shell-focus-timer"
            className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 rounded-lg border bg-card px-2 py-1 shadow"
          >
            <SprintTimer compact />
          </div>
        ) : null}
        <main
          id="main-content"
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
          className="min-h-dvh p-4 md:p-6"
        >
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh w-full">
      {backgroundServices}
      <SearchDialog />
      <SprintTicker />
      {skipLink}
      <Sidebar collapsed={sidebarCollapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main
          id="main-content"
          className={
            pathname === "/canvas"
              ? "flex-1"
              : "flex-1 px-4 pt-4 pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:px-8 md:py-8"
          }
        >
          {pathname === "/canvas" ? (
            children
          ) : (
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          )}
        </main>
      </div>
      <BottomNav />
      <CommandPalette />
    </div>
  );
}
