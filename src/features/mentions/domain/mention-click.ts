/**
 * Regras de abertura da ficha a partir de um nome destacado no texto
 * (item 15+17 da review: fix mobile + confirmação "Não perguntar de novo").
 *
 * O canal "modifier" (Ctrl/Cmd+clique) sempre abre direto — é um atalho
 * docado e não pode ser prejudicado. O canal "plain" (clique simples/toque)
 * pode exigir confirmação na camada de UI (editor-page).
 */
export type MentionClickSource = "modifier" | "plain";

export interface MentionClickContext {
  /** Dispositivo de toque (matchMedia "(hover: none)"). */
  isTouch: boolean;
  /** Ctrl/Cmd pressionado no clique. */
  hasModifier: boolean;
  /** Seleção do editor colapsada (sem arrasto de texto em andamento). */
  selectionCollapsed: boolean;
}

/**
 * Decide se um clique SEM modifier sobre um nome destacado no editor
 * editável deve abrir a ficha (em vez de posicionar o cursor).
 *
 * - Desktop: clique simples continua posicionando o caret (comportamento
 *   preservado da review — só toque abre).
 * - Touch: o toque abre, EXCETO quando o usuário está arrastando uma
 *   seleção de texto (seleção não colapsada não deve ser roubada).
 *
 * Modo leitura e Ctrl/Cmd+clique não passam por aqui (abrem direto).
 */
export function shouldOpenMentionOnPlainClick(
  context: MentionClickContext,
): boolean {
  if (context.hasModifier) return false;
  if (!context.isTouch) return false;
  return context.selectionCollapsed;
}

let touchCache: boolean | null = null;

/** Detecção de dispositivo de toque, memoizada (jsdom/SSR → false). */
export function isTouchDevice(): boolean {
  if (touchCache === null) {
    touchCache =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(hover: none)").matches;
  }
  return touchCache;
}
