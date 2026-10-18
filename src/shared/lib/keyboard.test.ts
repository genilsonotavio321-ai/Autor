import { describe, expect, it, vi } from "vitest";

import { handleDialogEnter } from "./keyboard";

function makeEvent(
  key: string,
  target: HTMLElement,
  modifiers: { shift?: boolean; ctrl?: boolean; alt?: boolean; composing?: boolean } = {},
) {
  return {
    key,
    shiftKey: Boolean(modifiers.shift),
    ctrlKey: Boolean(modifiers.ctrl),
    altKey: Boolean(modifiers.alt),
    nativeEvent: { isComposing: Boolean(modifiers.composing) },
    target,
    preventDefault: vi.fn(),
  } as unknown as Parameters<typeof handleDialogEnter>[0];
}

function input(): HTMLInputElement {
  const el = document.createElement("input");
  document.body.append(el);
  return el;
}

describe("handleDialogEnter", () => {
  it("saves on plain Enter in an input", () => {
    const onSave = vi.fn();
    const event = makeEvent("Enter", input());
    handleDialogEnter(event, onSave);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("ignores Textarea (Enter breaks the line)", () => {
    const onSave = vi.fn();
    const el = document.createElement("textarea");
    document.body.append(el);
    handleDialogEnter(makeEvent("Enter", el), onSave);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("ignores Button to avoid double submit", () => {
    const onSave = vi.fn();
    const el = document.createElement("button");
    document.body.append(el);
    handleDialogEnter(makeEvent("Enter", el), onSave);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("ignores Enter with modifiers", () => {
    const onSave = vi.fn();
    handleDialogEnter(makeEvent("Enter", input(), { shift: true }), onSave);
    handleDialogEnter(makeEvent("Enter", input(), { ctrl: true }), onSave);
    handleDialogEnter(makeEvent("Enter", input(), { alt: true }), onSave);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("ignores Enter during IME composition", () => {
    const onSave = vi.fn();
    handleDialogEnter(makeEvent("Enter", input(), { composing: true }), onSave);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("ignores targets inside a Tiptap editor", () => {
    const onSave = vi.fn();
    const tiptap = document.createElement("div");
    tiptap.className = "tiptap";
    const inner = document.createElement("p");
    tiptap.append(inner);
    document.body.append(tiptap);
    handleDialogEnter(makeEvent("Enter", inner), onSave);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("ignores other keys", () => {
    const onSave = vi.fn();
    handleDialogEnter(makeEvent("Escape", input()), onSave);
    expect(onSave).not.toHaveBeenCalled();
  });
});
