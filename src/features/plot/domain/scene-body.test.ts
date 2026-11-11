import { describe, expect, it } from "vitest";

import { EMPTY_SCENE_DOC } from "./repository";
import { docToSceneBody, sceneBodyToDoc } from "./scene-body";

describe("scene body", () => {
  it("converte cada linha em um parágrafo com texto", () => {
    const doc = sceneBodyToDoc("Ana entra.\nEla hesita.");
    expect(doc).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Ana entra." }] },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Ela hesita." }],
        },
      ],
    });
  });

  it("faz round-trip texto → doc → texto", () => {
    const text = "Linha um.\nLinha dois.";
    expect(docToSceneBody(sceneBodyToDoc(text))).toBe(text);
  });

  it("texto vazio (ou só espaços) vira o doc vazio padrão", () => {
    expect(sceneBodyToDoc("")).toEqual(EMPTY_SCENE_DOC);
    expect(sceneBodyToDoc("  \n \n")).toEqual(EMPTY_SCENE_DOC);
  });

  it("doc vazio/não estrutural extrai texto vazio", () => {
    expect(docToSceneBody(EMPTY_SCENE_DOC)).toBe("");
    expect(docToSceneBody(null)).toBe("");
    expect(docToSceneBody("texto solto")).toBe("");
  });
});
