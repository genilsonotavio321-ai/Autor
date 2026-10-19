import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";

import { GrifarMark } from "./grifar-mark";

function makeEditor(content: unknown = "<p>texto de teste</p>"): Editor {
  return new Editor({
    extensions: [StarterKit, GrifarMark],
    content: content as never,
  });
}

describe("GrifarMark", () => {
  it("aplica a marca na seleção e persiste no JSON", () => {
    const editor = makeEditor();
    editor.commands.setTextSelection({ from: 1, to: 5 });
    editor.commands.setMark("grifar");

    const json = editor.getJSON() as {
      content: Array<{
        content?: Array<{ text?: string; marks?: Array<{ type: string }> }>;
      }>;
    };
    const marks = json.content[0]?.content?.[0]?.marks;
    expect(marks?.some((mark) => mark.type === "grifar")).toBe(true);
    editor.destroy();
  });

  it("round-trip: JSON serializado e recriado mantém a marca", () => {
    const editor = makeEditor();
    editor.commands.setTextSelection({ from: 1, to: 5 });
    editor.commands.setMark("grifar");
    const json = JSON.parse(JSON.stringify(editor.getJSON()));
    editor.destroy();

    const restored = makeEditor(json);
    const restoredJson = restored.getJSON() as {
      content: Array<{
        content?: Array<{ marks?: Array<{ type: string }> }>;
      }>;
    };
    const marks = restoredJson.content[0]?.content?.[0]?.marks;
    expect(marks?.some((mark) => mark.type === "grifar")).toBe(true);
    restored.destroy();
  });

  it("renderiza como span.grifar no HTML", () => {
    const editor = makeEditor();
    editor.commands.setTextSelection({ from: 1, to: 5 });
    editor.commands.setMark("grifar");
    expect(editor.getHTML()).toContain('class="grifar"');
    editor.destroy();
  });

  it("faz parse de HTML existente com span.grifar", () => {
    const editor = makeEditor('<p><span class="grifar">destaque</span></p>');
    const json = editor.getJSON() as {
      content: Array<{
        content?: Array<{ marks?: Array<{ type: string }> }>;
      }>;
    };
    const marks = json.content[0]?.content?.[0]?.marks;
    expect(marks?.some((mark) => mark.type === "grifar")).toBe(true);
    editor.destroy();
  });

  it("unsetMark remove a marca", () => {
    const editor = makeEditor();
    editor.commands.setTextSelection({ from: 1, to: 5 });
    editor.commands.setMark("grifar");
    editor.commands.unsetMark("grifar");
    const json = editor.getJSON() as {
      content: Array<{
        content?: Array<{ marks?: Array<{ type: string }> }>;
      }>;
    };
    const marks = json.content[0]?.content?.[0]?.marks ?? [];
    expect(marks.some((mark) => mark.type === "grifar")).toBe(false);
    editor.destroy();
  });
});
