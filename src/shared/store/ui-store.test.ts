import { beforeEach, describe, expect, it } from "vitest";

import { useUiStore } from "@/shared/store/ui-store";

describe("useUiStore", () => {
  beforeEach(() => {
    useUiStore.setState({
      sidebarCollapsed: false,
      commandPaletteOpen: false,
    });
  });

  it("toggles the sidebar", () => {
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarCollapsed).toBe(false);
  });

  it("opens and closes the command palette", () => {
    useUiStore.getState().openCommandPalette();
    expect(useUiStore.getState().commandPaletteOpen).toBe(true);
    useUiStore.getState().closeCommandPalette();
    expect(useUiStore.getState().commandPaletteOpen).toBe(false);
  });

  it("toggles the command palette", () => {
    useUiStore.getState().toggleCommandPalette();
    expect(useUiStore.getState().commandPaletteOpen).toBe(true);
    useUiStore.getState().toggleCommandPalette();
    expect(useUiStore.getState().commandPaletteOpen).toBe(false);
  });

  it("persists sidebar state but not the transient palette", () => {
    localStorage.clear();
    useUiStore.getState().setSidebarCollapsed(true);
    useUiStore.getState().openCommandPalette();

    const raw = localStorage.getItem("autor-ui");
    expect(raw).toBeTruthy();
    expect(raw).not.toContain("commandPaletteOpen");
    expect(raw).toContain("sidebarCollapsed");
  });

  it("defaults the project list to most recently updated, grid layout", () => {
    expect(useUiStore.getState().projectsSort).toBe("updated-desc");
    expect(useUiStore.getState().projectsLayout).toBe("grid");
  });

  it("updates project sort and layout preferences", () => {
    useUiStore.getState().setProjectsSort("words-desc");
    useUiStore.getState().setProjectsLayout("list");
    expect(useUiStore.getState().projectsSort).toBe("words-desc");
    expect(useUiStore.getState().projectsLayout).toBe("list");
  });

  it("persists project and mention preferences", () => {
    localStorage.clear();
    useUiStore.getState().setProjectsSort("title-asc");
    useUiStore.getState().setMentionHighlightEnabled(false);
    useUiStore.getState().setMentionColorCharacter("#ff0000");

    const raw = localStorage.getItem("autor-ui");
    expect(raw).toBeTruthy();
    expect(raw).toContain("projectsSort");
    expect(raw).toContain("mentionHighlightEnabled");
    expect(raw).toContain("mentionColorCharacter");
  });

  it("toggles the mention highlight and stores both colors", () => {
    useUiStore.getState().setMentionHighlightEnabled(true);
    expect(useUiStore.getState().mentionHighlightEnabled).toBe(true);
    useUiStore.getState().setMentionHighlightEnabled(false);
    expect(useUiStore.getState().mentionHighlightEnabled).toBe(false);
    useUiStore.getState().setMentionColorLocation("#123456");
    expect(useUiStore.getState().mentionColorLocation).toBe("#123456");
  });

  it("toggles and persists the read-mode highlight independently", () => {
    localStorage.clear();
    expect(useUiStore.getState().mentionHighlightReadEnabled).toBe(true);
    useUiStore.getState().setMentionHighlightReadEnabled(false);
    expect(useUiStore.getState().mentionHighlightReadEnabled).toBe(false);
    expect(localStorage.getItem("autor-ui")).toContain(
      "mentionHighlightReadEnabled",
    );
    useUiStore.getState().setMentionHighlightReadEnabled(true);
    expect(useUiStore.getState().mentionHighlightReadEnabled).toBe(true);
  });

  it("seção 'Continuar escrevendo' é opt-in (padrão desligado)", () => {
    expect(useUiStore.getState().homeSections).not.toContain("continue");
  });

  it("ativa e persiste a seção 'continue' na página inicial", () => {
    localStorage.clear();
    useUiStore.getState().setHomeSections([
      "search",
      "continue",
      "projects",
    ]);
    expect(useUiStore.getState().homeSections).toContain("continue");
    expect(localStorage.getItem("autor-ui")).toContain('"continue"');
  });

  it("Painel some da navegação por padrão e o peso dos prompts é 50%", () => {
    expect(useUiStore.getState().panelTabVisible).toBe(false);
    expect(useUiStore.getState().promptCustomWeight).toBe(0.5);
  });

  it("alterna o Painel e grava o peso dos prompts com clamp", () => {
    localStorage.clear();
    useUiStore.getState().setPanelTabVisible(true);
    expect(useUiStore.getState().panelTabVisible).toBe(true);
    useUiStore.getState().setPromptCustomWeight(2);
    expect(useUiStore.getState().promptCustomWeight).toBe(1);
    useUiStore.getState().setPromptCustomWeight(-1);
    expect(useUiStore.getState().promptCustomWeight).toBe(0);
    expect(localStorage.getItem("autor-ui")).toContain("promptCustomWeight");
  });

  it("Desbloqueio fecha ao guardar por padrão e persiste o toggle", () => {
    localStorage.clear();
    expect(useUiStore.getState().unblockCloseOnSave).toBe(true);
    useUiStore.getState().setUnblockCloseOnSave(false);
    expect(useUiStore.getState().unblockCloseOnSave).toBe(false);
    expect(localStorage.getItem("autor-ui")).toContain("unblockCloseOnSave");
  });

  it("Botões flutuantes do canvas visíveis por padrão e o toggle persiste", () => {
    localStorage.clear();
    expect(useUiStore.getState().canvasButtonsHidden).toBe(false);
    useUiStore.getState().setCanvasButtonsHidden(true);
    expect(useUiStore.getState().canvasButtonsHidden).toBe(true);
    expect(localStorage.getItem("autor-ui")).toContain("canvasButtonsHidden");
  });
});
