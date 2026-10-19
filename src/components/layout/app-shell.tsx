"use client";

import { useEffect, useState } from "react";

import { CommandPalette } from "@/components/command-palette";
import { MobileNav, Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { SearchDialog } from "@/features/search/ui/search-dialog";
import { playSound } from "@/shared/lib/sound";
import { useUiStore } from "@/shared/store/ui-store";

// Efeitos sonoros: clique em qualquer botão/link toca o som "click" (item 6).
function useClickSound() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const { soundEnabled, soundVolume } = useUiStore.getState();
      if (!soundEnabled || soundVolume === 0) return;
      const target = event.target as Element | null;
      if (!target?.closest('button, [role="button"], a[href]')) return;
      playSound("click", soundVolume);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);
}

// Estilo global de animações (item 9): duração ajustável ou desativar tudo.
function MotionStyle() {
  const enabled = useUiStore((state) => state.animationsEnabled);
  const duration = useUiStore((state) => state.animationDuration);
  const css = enabled
    ? `*,::before,::after{transition-duration:${duration}ms!important;animation-duration:${duration}ms!important}`
    : `*,::before,::after{transition:none!important;animation:none!important}`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const focusMode = useUiStore((state) => state.focusMode);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useClickSound();

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

  // Focus mode: hide sidebar/topbar/palette so only the writing surface shows.
  if (focusMode) {
    return (
      <div className="min-h-svh w-full">
        {motionStyle}
        {searchDialog}
        {skipLink}
        <main id="main-content" className="min-h-svh">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh w-full">
      {motionStyle}
      {searchDialog}
      {skipLink}
      <Sidebar collapsed={sidebarCollapsed} />
      <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={handleMenuClick} />
        <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
