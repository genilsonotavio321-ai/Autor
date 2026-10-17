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
});
