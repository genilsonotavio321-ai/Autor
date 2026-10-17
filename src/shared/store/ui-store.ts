import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  /** Hides app chrome while writing (plan: focus mode). Not persisted. */
  focusMode: boolean;
  /** Project currently shown in planning pages (outline, timeline, notes). */
  selectedProjectId: string | null;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  setFocusMode: (enabled: boolean) => void;
  toggleFocusMode: () => void;
  setSelectedProjectId: (projectId: string | null) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      commandPaletteOpen: false,
      focusMode: false,
      selectedProjectId: null,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      openCommandPalette: () => set({ commandPaletteOpen: true }),
      closeCommandPalette: () => set({ commandPaletteOpen: false }),
      toggleCommandPalette: () =>
        set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
      setFocusMode: (enabled) => set({ focusMode: enabled }),
      toggleFocusMode: () =>
        set((state) => ({ focusMode: !state.focusMode })),
      setSelectedProjectId: (projectId) => set({ selectedProjectId: projectId }),
    }),
    {
      name: "autor-ui",
      // Transient state (palette) must not persist across sessions.
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        selectedProjectId: state.selectedProjectId,
      }),
    },
  ),
);
