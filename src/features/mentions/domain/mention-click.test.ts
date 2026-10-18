import { describe, expect, it } from "vitest";

import {
  isTouchDevice,
  shouldOpenMentionOnPlainClick,
} from "./mention-click";

describe("shouldOpenMentionOnPlainClick", () => {
  it("abre no toque com seleção colapsada", () => {
    expect(
      shouldOpenMentionOnPlainClick({
        isTouch: true,
        hasModifier: false,
        selectionCollapsed: true,
      }),
    ).toBe(true);
  });

  it("não abre no toque quando há seleção de texto em andamento", () => {
    expect(
      shouldOpenMentionOnPlainClick({
        isTouch: true,
        hasModifier: false,
        selectionCollapsed: false,
      }),
    ).toBe(false);
  });

  it("não abre com clique simples em desktop (caret posiciona)", () => {
    expect(
      shouldOpenMentionOnPlainClick({
        isTouch: false,
        hasModifier: false,
        selectionCollapsed: true,
      }),
    ).toBe(false);
  });

  it("nunca decide pelo canal modifier (Ctrl/Cmd abre direto)", () => {
    expect(
      shouldOpenMentionOnPlainClick({
        isTouch: true,
        hasModifier: true,
        selectionCollapsed: true,
      }),
    ).toBe(false);
    expect(
      shouldOpenMentionOnPlainClick({
        isTouch: false,
        hasModifier: true,
        selectionCollapsed: false,
      }),
    ).toBe(false);
  });
});

describe("isTouchDevice", () => {
  it("retorna false em jsdom (sem matchMedia hover: none)", () => {
    expect(isTouchDevice()).toBe(false);
  });
});
