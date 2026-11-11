import type { KeyboardEvent as ReactKeyboardEvent } from "react";

const SAVE_IGNORE_TAGS = new Set(["TEXTAREA", "BUTTON"]);

/**
 * Enter-to-save para diálogos (padrão UX do app).
 *
 * Regras:
 * - Só responde a Enter sem Shift/Ctrl/Alt e fora de composição (IME).
 * - Ignora TEXTAREA (Enter quebra linha), BUTTON (evita duplo-submit com o
 *   botão já focado) e elementos dentro de um editor Tiptap (.tiptap).
 * - Demais alvos (INPUT, selects, etc.) disparam `onSave` com preventDefault.
 */
export function handleDialogEnter(
  event: ReactKeyboardEvent,
  onSave: () => void,
): void {
  if (event.key !== "Enter") return;
  if (event.shiftKey || event.ctrlKey || event.altKey) return;
  if (event.nativeEvent.isComposing) return;

  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (SAVE_IGNORE_TAGS.has(target.tagName)) return;
  if (target.closest(".tiptap")) return;

  event.preventDefault();
  onSave();
}
