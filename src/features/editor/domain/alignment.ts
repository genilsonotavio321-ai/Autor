import type { EditorState } from "@tiptap/pm/state";

/**
 * Alinhamento de texto por parágrafo (item 20).
 *
 * Limitações conhecidas, documentadas de propósito:
 * - Markdown (.md) não tem alinhamento: exportar em .md perde o `textAlign`.
 * - O PDF (jspdf) e o DOCX atuais escrevem os parágrafos sem `textAlign`.
 * - font-family/font-size continuam sendo propriedades do container do
 *   editor (não há fonte por parágrafo — fora de escopo).
 */

/** Valores aceitos pelo `@tiptap/extension-text-align`. */
export type TextAlignValue = "left" | "center" | "right" | "justify";

/** Nós que podem receber alinhamento (mesma lista passada ao TextAlign). */
const ALIGNABLE_NODES = new Set(["heading", "paragraph"]);

/**
 * Aplica o alinhamento a todos os headings/parágrafos do documento
 * ("Capítulo inteiro"), preservando a seleção do usuário.
 *
 * `setNodeMarkup` só troca atributos, então os tamanhos das posições não
 * mudam; a seleção do usuário é preservada automaticamente (a transação
 * remapeia a seleção atual por cima de cada passo).
 */
export function setDocumentAlignment(
  state: EditorState,
  value: TextAlignValue,
) {
  const { tr } = state;
  state.doc.descendants((node, pos) => {
    if (!ALIGNABLE_NODES.has(node.type.name)) return;
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, textAlign: value });
  });
  return tr;
}
