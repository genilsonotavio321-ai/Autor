import type { Json } from "@/shared/types/database";

import { EMPTY_SCENE_DOC } from "./repository";

function textOfNode(node: Json): string {
  if (node === null || typeof node !== "object" || Array.isArray(node)) {
    return "";
  }
  const children = node.content;
  if (!Array.isArray(children)) return "";
  return children
    .map((child) => {
      if (child === null || typeof child !== "object" || Array.isArray(child)) {
        return "";
      }
      return typeof child.text === "string" ? child.text : "";
    })
    .join("");
}

/**
 * Converte texto puro em documento Tiptap: 1 linha = 1 parágrafo. Texto vazio
 * devolve o doc vazio padrão (não conta como corpo no modo leitura).
 */
export function sceneBodyToDoc(text: string): Json {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) return structuredClone(EMPTY_SCENE_DOC);
  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    })),
  };
}

/** Extrai o texto puro de um documento (parágrafos viram linhas). */
export function docToSceneBody(doc: Json): string {
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) return "";
  const content = doc.content;
  if (!Array.isArray(content)) return "";
  return content
    .map((node) => textOfNode(node))
    .filter((line) => line.trim().length > 0)
    .join("\n");
}
