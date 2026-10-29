"use client";

import { useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { CommandPalette } from "@/components/command-palette";
import { MobileNav, Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { SearchDialog } from "@/features/search/ui/search-dialog";
import { SprintTimer } from "@/features/productivity/ui/sprint-timer";
import { SprintTicker } from "@/features/productivity/ui/sprint-ticker";
import { NotificationMonitor } from "@/features/productivity/ui/notification-monitor";
import { TrashAutoPurge } from "@/features/projects/ui/trash-auto-purge";
import { playClickSound } from "@/shared/lib/sound";
import { useUiStore } from "@/shared/store/ui-store";

// Efeitos sonoros: clique em qualquer botão/link toca o som "click" (item 6).
function useClickSound() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest('button, [role="button"], a[href]')) return;
      playClickSound();
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);
}

// Estilo global de animações (item 9): duração ajustável ou desativar tudo.
// Fonte de verdade é o toggle "Desativar animações" do app — não seguimos
// prefers-reduced-motion do SO porque o usuário já tem controle explícito aqui
// (e o reduce silencioso anulava toggles ligados, confundindo).
function MotionStyle() {
  const enabled = useUiStore((state) => state.animationsEnabled);
  const duration = useUiStore((state) => state.animationDuration);
  const css = enabled
    ? `*,::before,::after{transition-duration:${duration}ms!important;animation-duration:${duration}ms!important}[data-dragging]{transition:none!important}[data-radix-popper-content-wrapper]{transition:none!important}#main-content{animation-duration:${Math.max(duration, 280)}ms!important}`
    : `*,::before,::after{transition:none!important;animation:none!important}`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

// Variante de tema (Sépia, Meia-noite...): next-themes só escreve light/dark,
// então a variante vira atributo no <html> consumido pelo globals.css.
function useThemeVariantAttribute() {
  const themeVariantLight = useUiStore((state) => state.themeVariantLight);
  const themeVariantDark = useUiStore((state) => state.themeVariantDark);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const variant =
      resolvedTheme === "dark" ? themeVariantDark : themeVariantLight;
    const root = document.documentElement;
    if (variant === "padrao") root.removeAttribute("data-theme-variant");
    else root.setAttribute("data-theme-variant", variant);
  }, [resolvedTheme, themeVariantLight, themeVariantDark]);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const focusMode = useUiStore((state) => state.focusMode);
  const sprintRunning = useUiStore((state) => state.sprintRunning);
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pageTransitionEnabled = useUiStore(
    (state) => state.pageTransitionEnabled,
  );

  useClickSound();
  useThemeVariantAttribute();

  const handleMenuClick = () => {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (isMobile) {
      setMobileNavOpen((open) => !open);
    } else {
      toggleSidebar();
    }
  };

  const skipLink = (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:border focus:bg-background focus:px-3 focus:py-2 focus:shadow-md"
    >
      Pular para o conteúdo
    </a>
  );

  const motionStyle = <MotionStyle />;
  const searchDialog = <SearchDialog />;
  // Serviços persistentes do shell: expiração da lixeira e notificações.
  const backgroundServices = (
    <>
      <TrashAutoPurge />
      <NotificationMonitor />
    </>
  );
  const sprintTicker = <SprintTicker />;
  // key={pathname} remonta o <main> a cada navegação, disparando a animação
  // de entrada. Piso de 280ms no MotionStyle porque o slider global pode
  // descer a 50ms — velocidade imperceptível para esta transição.
  const pageMotionClass = pageTransitionEnabled
    ? "animate-in fade-in-0 slide-in-from-bottom-4 zoom-in-95"
    : "";

  // Focus mode: hide sidebar/topbar/palette so only the writing surface shows.
  if (focusMode) {
    return (
      <div className="min-h-svh w-full">
        {motionStyle}
        {backgroundServices}
        {searchDialog}
        {sprintTicker}
        {skipLink}
        {/* Fora da página de escrita (que já tem o timer completo), o focus
            mode esconde o Topbar — sem este flutuante não haveria como pausar. */}
        {sprintRunning && !pathname.startsWith("/write") ? (
          <div
            data-slot="app-shell-focus-timer"
            className="fixed right-4 bottom-4 z-40 rounded-lg border bg-card px-2 py-1 shadow"
          >
            <SprintTimer compact />
          </div>
        ) : null}
        <main
          id="main-content"
          key={pathname}
          // Tela cheia no iPhone: sem topbar aqui, a área segura faz o papel.
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
          className={`min-h-svh p-4 md:p-6 ${pageMotionClass}`}
        >
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh w-full">
      {motionStyle}
      {backgroundServices}
      {searchDialog}
      {sprintTicker}
      {skipLink}
      <Sidebar collapsed={sidebarCollapsed} />
      <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={handleMenuClick} />
        <main
          id="main-content"
          key={pathname}
          className={`flex-1 overflow-y-auto ${
            pathname === "/canvas" ? "p-0" : "p-4 md:p-6"
          } ${pageMotionClass}`}
        >
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
