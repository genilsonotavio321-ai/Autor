"use client";

import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { CommandPalette } from "@/components/command-palette";
import { ActionBar, ActionBarProvider } from "@/components/layout/action-bar";
import { LoadingOverlay } from "@/components/layout/loading-overlay";
import { Sidebar } from "@/components/layout/sidebar";
import { SwipeNavigation } from "@/components/layout/swipe-navigation";
import { Topbar } from "@/components/layout/topbar";
import { usePageTransition } from "@/components/layout/use-page-transition";
import { SearchDialog } from "@/features/search/ui/search-dialog";
import { TrashAutoPurge } from "@/features/projects/ui/trash-auto-purge";
import {
  resolveResumeRoute,
  RESUME_GUARD_KEY,
} from "@/infra/navigation/resume-last-edit";
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

/**
 * Retoma a escrita no primeiro carregamento do app: quem abre a raiz "/"
 * volta ao capítulo e ao ponto exato da última edição. Navegar para "/"
 * depois disso mostra a home normalmente.
 */
function useResumeLastEdit() {
  const router = useRouter();
  const pathname = usePathname();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    if (pathname !== "/") return;
    try {
      if (window.sessionStorage.getItem(RESUME_GUARD_KEY)) return;
      window.sessionStorage.setItem(RESUME_GUARD_KEY, "1");
    } catch {
      // sessionStorage indisponível (modo privado): tenta uma vez mesmo assim.
    }
    void resolveResumeRoute()
      .then((route) => {
        // O usuário pode ter navegado enquanto o banco abria: só retoma se
        // ele ainda estiver na raiz.
        if (route && window.location.pathname === "/") router.replace(route);
      })
      .catch(() => undefined);
  }, [pathname, router]);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const pathname = usePathname();

  useThemeVariantAttribute();
  useAnimationPreference();
  useResumeLastEdit();
  usePageTransition();

  const isEditor = pathname.startsWith("/write");

  const skipLink = (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:border focus:bg-background focus:px-3 focus:py-2 focus:shadow-md"
    >
      Pular para o conteúdo
    </a>
  );

  // Serviço persistente do shell: expiração da lixeira.
  const backgroundServices = <TrashAutoPurge />;

  // O editor ocupa a tela inteira: sem sidebar, topbar nem barras flutuantes.
  if (isEditor) {
    return (
      <ActionBarProvider>
        <div className="min-h-dvh w-full">
          <LoadingOverlay />
          {backgroundServices}
          <SearchDialog />
          {skipLink}
          <main
            id="main-content"
            style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
            className="min-h-dvh w-full px-4 pb-[max(2rem,env(safe-area-inset-bottom))] md:px-10"
          >
            {children}
          </main>
        </div>
      </ActionBarProvider>
    );
  }

  return (
    <ActionBarProvider>
      <div className="flex min-h-dvh w-full">
        <LoadingOverlay />
        {backgroundServices}
        <SearchDialog />
        {skipLink}
        <Sidebar collapsed={sidebarCollapsed} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main
            id="main-content"
            className={
              pathname === "/canvas"
                ? "flex-1"
                : "flex-1 px-4 pt-4 pb-[calc(9rem+env(safe-area-inset-bottom))] md:px-8 md:py-8 md:pb-24"
            }
          >
            {pathname === "/canvas" ? (
              children
            ) : (
              <div className="mx-auto w-full max-w-6xl">{children}</div>
            )}
          </main>
        </div>
        <ActionBar />
        <SwipeNavigation />
        <CommandPalette />
      </div>
    </ActionBarProvider>
  );
}
