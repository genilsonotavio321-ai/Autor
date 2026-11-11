import { Mark, mergeAttributes } from "@tiptap/core";

/**
 * Marca de destaque manual ("Grifar"): seleção → toggleMark("grifar").
 * Persistida no JSON do capítulo como `marks: [{ type: "grifar" }]` e
 * renderizada como `<span class="grifar">` (ver globals.css).
 */
export const GrifarMark = Mark.create({
  name: "grifar",

  parseHTML() {
    return [{ tag: "span.grifar" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "grifar" }),
      0,
    ];
  },
});
