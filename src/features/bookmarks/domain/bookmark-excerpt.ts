import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

/** Tamanho do trecho exibido na lista de marcadores. */
const EXCERPT_LENGTH = 90;
/** Janela de texto lida a partir da posição do marcador. */
const SEARCH_LENGTH = 160;

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Trecho legível em volta de uma posição do documento, usado como rótulo do
 * marcador. Lê para frente a partir da posição; no fim de um bloco (sem texto
 * adiante) recorre ao texto anterior, para o marcador nunca ficar sem contexto.
 */
export function bookmarkExcerpt(
  doc: ProseMirrorNode,
  position: number,
): string {
  const size = doc.content.size;
  const start = Math.min(Math.max(position, 0), size);

  const forward = collapse(
    doc.textBetween(start, Math.min(start + SEARCH_LENGTH, size), " "),
  );
  if (forward.length > 0) {
    return forward.length > EXCERPT_LENGTH
      ? `${forward.slice(0, EXCERPT_LENGTH).trimEnd()}…`
      : forward;
  }

  const backward = collapse(
    doc.textBetween(Math.max(0, start - SEARCH_LENGTH), start, " "),
  );
  if (backward.length === 0) return "Marcador";
  const tail =
    backward.length > EXCERPT_LENGTH
      ? backward.slice(-EXCERPT_LENGTH).trimStart()
      : backward;
  return `…${tail}`;
}
