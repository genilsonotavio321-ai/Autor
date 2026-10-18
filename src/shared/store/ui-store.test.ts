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
});
