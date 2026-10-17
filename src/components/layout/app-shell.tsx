"use client";

import { useState } from "react";

import { CommandPalette } from "@/components/command-palette";
import { MobileNav, Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useUiStore } from "@/shared/store/ui-store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const focusMode = useUiStore((state) => state.focusMode);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

  // Focus mode: hide sidebar/topbar/palette so only the writing surface shows.
  if (focusMode) {
    return (
      <div className="min-h-svh w-full">
        {skipLink}
        <main id="main-content" className="min-h-svh">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh w-full">
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
