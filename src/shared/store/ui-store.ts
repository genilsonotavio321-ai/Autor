import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Fontes disponíveis para o editor (plan §7.8). */
export type EditorFontFamily = "serif" | "sans";

export const EDITOR_FONT_SIZE_MIN = 14;
export const EDITOR_FONT_SIZE_MAX = 24;

/** Ordenação da lista de projetos (plan §7.10). */
export type ProjectsSort =
  | "updated-desc"
  | "created-desc"
  | "created-asc"
  | "title-asc"
  | "words-desc"
  | "reading-desc";

export const PROJECTS_SORT_LABELS: Record<ProjectsSort, string> = {
  "updated-desc": "Alterados recentemente",
  "created-desc": "Mais recentes",
  "created-asc": "Mais antigos",
  "title-asc": "Ordem alfabética (A–Z)",
  "words-desc": "Mais palavras",
  "reading-desc": "Maior tempo de leitura",
};

/** Como os projetos são dispostos na lista. */
export type ProjectsLayout = "grid" | "list";

/** Variantes de tema por base (claro/escuro) — item: paletas escolhíveis. */
export type ThemeVariantLight = "padrao" | "sepia" | "areia";
export type ThemeVariantDark = "padrao" | "meia-noite" | "floresta";

/** Seções oferecidas na página inicial (item 10). */
export type HomeSection =
  | "search"
  | "projects"
  | "dashboard"
  | "data"
  | "continue";

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
  /** Cronômetro de sprint (transiente, não persiste). */
  sprintRemaining: number;
  sprintRunning: boolean;
  sprintCompleted: number;
  sprintAnnouncement: string;
  /** Focus mode ligado pelo sprint — restaurado ao pausar/concluir. */
  sprintFocusEngaged: boolean;
  /** Tempo de exibição do botão "Continuar de onde parou" (segundos). */
  resumeNoticeSeconds: number;
  /** Ordenação e disposição da lista de projetos. */
  projectsSort: ProjectsSort;
  projectsLayout: ProjectsLayout;
  /** Destaque de nomes de personagens e locais no texto. */
  mentionHighlightEnabled: boolean;
  /** Destaque no modo leitura (independe do editor). */
  mentionHighlightReadEnabled: boolean;
  /** Botão "Grifar" na seleção no modo leitura. */
  readGrifarEnabled: boolean;
  /** Pergunta antes de abrir ficha ao tocar num destaque (item 17). */
  mentionConfirmOpen: boolean;
  mentionColorCharacter: string;
  mentionColorLocation: string;
  /** Mostra o pop-up "Voltar ao texto" ao abrir a ficha pelo editor. */
  mentionBackToTextEnabled: boolean;
  /** Segundos até o pop-up "Voltar ao texto" desaparecer (0 = nunca). */
  mentionBackToTextSeconds: number;
  /** Popup de busca (item 2). Transiente. */
  searchOpen: boolean;
  /** Efeitos sonoros nos botões (item 6). */
  soundEnabled: boolean;
  /** Volume dos efeitos sonoros, 0–100 (item 6). */
  soundVolume: number;
  /** Animações do app ligadas (item 9). */
  animationsEnabled: boolean;
  /** Variante de tema aplicada sobre a base light/dark (next-themes). */
  themeVariantLight: ThemeVariantLight;
  themeVariantDark: ThemeVariantDark;
  /** Duração global das animações em ms (item 9). */
  animationDuration: number;
  /** Transição de entrada ao trocar de seção/página. */
  pageTransitionEnabled: boolean;
  /** Layout do editor enxuto: formatação só na seleção, botões dentro do editor. */
  editorSimplified: boolean;
  /** Busca inclui seções/opções do app (item 3). */
  searchGlobalEnabled: boolean;
  /** Seções da página inicial (item 4). */
  homeSections: HomeSection[];
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
  toggleSprintRunning: () => void;
  resetSprint: () => void;
  completeSprint: () => void;
  setResumeNoticeSeconds: (seconds: number) => void;
  setProjectsSort: (sort: ProjectsSort) => void;
  setProjectsLayout: (layout: ProjectsLayout) => void;
  setMentionHighlightEnabled: (enabled: boolean) => void;
  setMentionHighlightReadEnabled: (enabled: boolean) => void;
  setReadGrifarEnabled: (enabled: boolean) => void;
  setMentionConfirmOpen: (open: boolean) => void;
  setMentionColorCharacter: (color: string) => void;
  setMentionColorLocation: (color: string) => void;
  setMentionBackToTextEnabled: (enabled: boolean) => void;
  setMentionBackToTextSeconds: (seconds: number) => void;
  openSearch: () => void;
  closeSearch: () => void;
  setSoundEnabled: (enabled: boolean) => void;
  setSoundVolume: (volume: number) => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  setThemeVariantLight: (variant: ThemeVariantLight) => void;
  setThemeVariantDark: (variant: ThemeVariantDark) => void;
  setAnimationDuration: (duration: number) => void;
  setPageTransitionEnabled: (enabled: boolean) => void;
  setEditorSimplified: (enabled: boolean) => void;
  setSearchGlobalEnabled: (enabled: boolean) => void;
  setHomeSections: (sections: HomeSection[]) => void;
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
      sprintRemaining: 25 * 60,
      sprintRunning: false,
      sprintCompleted: 0,
      sprintAnnouncement: "",
      sprintFocusEngaged: false,
      resumeNoticeSeconds: 5,
      projectsSort: "updated-desc",
      projectsLayout: "grid",
      mentionHighlightEnabled: true,
      mentionHighlightReadEnabled: true,
      readGrifarEnabled: true,
      mentionConfirmOpen: true,
      mentionColorCharacter: "#7c3aed",
      mentionColorLocation: "#0d9488",
      mentionBackToTextEnabled: true,
      mentionBackToTextSeconds: 8,
      searchOpen: false,
      soundEnabled: false,
      soundVolume: 50,
      animationsEnabled: true,
      animationDuration: 150,
      pageTransitionEnabled: true,
      editorSimplified: true,
      themeVariantLight: "padrao",
      themeVariantDark: "padrao",
      searchGlobalEnabled: true,
      homeSections: ["search", "projects", "data"],
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
      toggleSprintRunning: () =>
        set((state) => {
          if (!state.sprintRunning) {
            return {
              sprintRunning: true,
              sprintAnnouncement: "Sprint iniciado.",
              focusMode: true,
              // Só restaura o focus mode se o sprint foi quem ligou.
              sprintFocusEngaged:
                state.sprintFocusEngaged || !state.focusMode,
            };
          }
          return {
            sprintRunning: false,
            sprintAnnouncement: "Sprint pausado.",
            ...(state.sprintFocusEngaged
              ? { focusMode: false, sprintFocusEngaged: false }
              : {}),
          };
        }),
      resetSprint: () =>
        set((state) => ({
          sprintRunning: false,
          sprintRemaining: Math.max(1, state.sprintMinutes) * 60,
          sprintAnnouncement: "Sprint reiniciado.",
          ...(state.sprintFocusEngaged
            ? { focusMode: false, sprintFocusEngaged: false }
            : {}),
        })),
      completeSprint: () =>
        set((state) => ({
          sprintRunning: false,
          sprintRemaining: Math.max(1, state.sprintMinutes) * 60,
          sprintCompleted: state.sprintCompleted + 1,
          sprintAnnouncement: "Sprint concluído. Faça uma pausa.",
          ...(state.sprintFocusEngaged
            ? { focusMode: false, sprintFocusEngaged: false }
            : {}),
        })),
      setResumeNoticeSeconds: (seconds) =>
        set({ resumeNoticeSeconds: clamp(seconds, 0, 30) }),
      setProjectsSort: (sort) => set({ projectsSort: sort }),
      setProjectsLayout: (layout) => set({ projectsLayout: layout }),
      setMentionHighlightEnabled: (enabled) =>
        set({ mentionHighlightEnabled: enabled }),
      setMentionHighlightReadEnabled: (enabled) =>
        set({ mentionHighlightReadEnabled: enabled }),
      setReadGrifarEnabled: (enabled) => set({ readGrifarEnabled: enabled }),
      setMentionConfirmOpen: (open) => set({ mentionConfirmOpen: open }),
      setMentionColorCharacter: (color) =>
        set({ mentionColorCharacter: color }),
      setMentionColorLocation: (color) => set({ mentionColorLocation: color }),
      setMentionBackToTextEnabled: (enabled) =>
        set({ mentionBackToTextEnabled: enabled }),
      setMentionBackToTextSeconds: (seconds) =>
        set({ mentionBackToTextSeconds: clamp(seconds, 0, 30) }),
      openSearch: () => set({ searchOpen: true }),
      closeSearch: () => set({ searchOpen: false }),
      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
      setSoundVolume: (volume) =>
        set({ soundVolume: clamp(volume, 0, 100) }),
      setAnimationsEnabled: (enabled) => set({ animationsEnabled: enabled }),
      setThemeVariantLight: (variant) => set({ themeVariantLight: variant }),
      setThemeVariantDark: (variant) => set({ themeVariantDark: variant }),
      setAnimationDuration: (duration) =>
        set({ animationDuration: clamp(duration, 50, 1000) }),
      setPageTransitionEnabled: (enabled) =>
        set({ pageTransitionEnabled: enabled }),
      setEditorSimplified: (enabled) => set({ editorSimplified: enabled }),
      setSearchGlobalEnabled: (enabled) =>
        set({ searchGlobalEnabled: enabled }),
      setHomeSections: (sections) => set({ homeSections: sections }),
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
        projectsSort: state.projectsSort,
        projectsLayout: state.projectsLayout,
        mentionHighlightEnabled: state.mentionHighlightEnabled,
        mentionHighlightReadEnabled: state.mentionHighlightReadEnabled,
        readGrifarEnabled: state.readGrifarEnabled,
        mentionConfirmOpen: state.mentionConfirmOpen,
        mentionColorCharacter: state.mentionColorCharacter,
        mentionColorLocation: state.mentionColorLocation,
        mentionBackToTextEnabled: state.mentionBackToTextEnabled,
        mentionBackToTextSeconds: state.mentionBackToTextSeconds,
        soundEnabled: state.soundEnabled,
        soundVolume: state.soundVolume,
        animationsEnabled: state.animationsEnabled,
        animationDuration: state.animationDuration,
        pageTransitionEnabled: state.pageTransitionEnabled,
        editorSimplified: state.editorSimplified,
        themeVariantLight: state.themeVariantLight,
        themeVariantDark: state.themeVariantDark,
        searchGlobalEnabled: state.searchGlobalEnabled,
        homeSections: state.homeSections,
      }),
    },
  ),
);
