import { Schema } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";

import { setDocumentAlignment } from "./alignment";

/** Schema mínimo equivalente ao que o TextAlign adiciona (attrs.textAlign). */
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: {
      group: "block",
      content: "inline*",
      attrs: { textAlign: { default: null } },
    },
    heading: {
      group: "block",
      content: "inline*",
      attrs: { level: { default: 1 }, textAlign: { default: null } },
    },
    text: { group: "inline" },
  },
});

function paragraph(text: string) {
  return {
    type: "paragraph",
    content: text ? [{ type: "text", text }] : [],
  };
}

function heading(text: string, level: number) {
  return {
    type: "heading",
    attrs: { level, textAlign: null },
    content: [{ type: "text", text }],
  };
}

function makeState(content: object[]) {
  return EditorState.create({
    schema,
    doc: schema.nodeFromJSON({ type: "doc", content }),
  });
}

function alignments(doc: { toJSON: () => unknown }) {
  const json = doc.toJSON() as {
    content?: { attrs?: { textAlign?: string | null } }[];
  };
  return (json.content ?? []).map((node) => node.attrs?.textAlign ?? null);
}

describe("setDocumentAlignment", () => {
  it("aplica textAlign a todos os parágrafos e headings", () => {
    const state = makeState([
      heading("Capítulo", 1),
      paragraph("Primeiro."),
      paragraph("Segundo."),
    ]);

    const next = setDocumentAlignment(state, "center");

    expect(alignments(next.doc)).toEqual(["center", "center", "center"]);
  });

  it("preserva os demais atributos, como o level do heading", () => {
    const state = makeState([heading("Capítulo", 2)]);

    const next = setDocumentAlignment(state, "justify");
    const json = next.doc.toJSON() as {
      content: { attrs: { level: number; textAlign: string } }[];
    };

    expect(json.content[0]?.attrs).toMatchObject({
      level: 2,
      textAlign: "justify",
    });
  });

  it("não altera o conteúdo do texto", () => {
    const state = makeState([paragraph("Uma frase qualquer.")]);

    const next = setDocumentAlignment(state, "right");

    expect(next.doc.textContent).toBe("Uma frase qualquer.");
    expect(next.doc.childCount).toBe(1);
  });

  it("mantém a seleção do usuário", () => {
    const base = makeState([
      paragraph("Primeiro."),
      paragraph("Segundo."),
    ]);
    const withSelection = base.apply(
      base.tr.setSelection(TextSelection.create(base.doc, 3)),
    );

    const next = setDocumentAlignment(withSelection, "left");

    expect(next.selection.from).toBe(3);
    expect(next.selection.empty).toBe(true);
  });

  it("aplica também a parágrafos vazios", () => {
    const state = makeState([paragraph("")]);

    const next = setDocumentAlignment(state, "center");

    expect(alignments(next.doc)).toEqual(["center"]);
  });
});
