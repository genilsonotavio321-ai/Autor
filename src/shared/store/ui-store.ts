import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Fontes disponíveis para o editor (plan §7.8). */
export type EditorFontFamily = "serif" | "sans";

export const EDITOR_FONT_SIZE_MIN = 14;
export const EDITOR_FONT_SIZE_MAX = 24;

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

interface UiState {
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  /** Hides app chrome while writing (plan: focus mode). Not persisted. */
  focusMode: boolean;
  /** Project currently shown in planning pages (outline, timeline, notes). */
  selectedProjectId: string | null;
  /** Personalização: fonte e tamanho do editor. */
  editorFontFamily: EditorFontFamily;
  editorFontSize: number;
  /** Meta diária de palavras. */
  dailyWordGoal: number;
  /** Duração de uma sessão de sprint (minutos). */
  sprintMinutes: number;
  /** Tempo de exibição do botão "Continuar de onde parou" (segundos). */
  resumeNoticeSeconds: number;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  setFocusMode: (enabled: boolean) => void;
  toggleFocusMode: () => void;
  setSelectedProjectId: (projectId: string | null) => void;
  setEditorFontFamily: (family: EditorFontFamily) => void;
  setEditorFontSize: (size: number) => void;
  setDailyWordGoal: (goal: number) => void;
  setSprintMinutes: (minutes: number) => void;
  setResumeNoticeSeconds: (seconds: number) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      commandPaletteOpen: false,
      focusMode: false,
      selectedProjectId: null,
      editorFontFamily: "serif",
      editorFontSize: 18,
      dailyWordGoal: 500,
      sprintMinutes: 25,
      resumeNoticeSeconds: 5,
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
      setEditorFontFamily: (family) => set({ editorFontFamily: family }),
      setEditorFontSize: (size) =>
        set({
          editorFontSize: clamp(size, EDITOR_FONT_SIZE_MIN, EDITOR_FONT_SIZE_MAX),
        }),
      setDailyWordGoal: (goal) => set({ dailyWordGoal: Math.max(0, goal || 0) }),
      setSprintMinutes: (minutes) =>
        set({ sprintMinutes: clamp(minutes, 1, 120) }),
      setResumeNoticeSeconds: (seconds) =>
        set({ resumeNoticeSeconds: clamp(seconds, 0, 30) }),
    }),
    {
      name: "autor-ui",
      // Transient state (palette, focus mode) must not persist across sessions.
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        selectedProjectId: state.selectedProjectId,
        editorFontFamily: state.editorFontFamily,
        editorFontSize: state.editorFontSize,
        dailyWordGoal: state.dailyWordGoal,
        sprintMinutes: state.sprintMinutes,
        resumeNoticeSeconds: state.resumeNoticeSeconds,
      }),
    },
  ),
);
