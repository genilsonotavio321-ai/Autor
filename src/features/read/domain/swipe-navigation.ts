/**
 * Decisoes do deslize horizontal (celular). Fica fora dos componentes para
 * poder ser testado sem DOM: o hook so mede o gesto.
 */

export type SwipeDirection = "left" | "right";

export type ReadingSwipeResult =
  | { type: "chapter"; index: number }
  | { type: "project" }
  | { type: "none" };

/**
 * Deslize no modo leitura: direita volta um capitulo (e sai para o projeto a
 * partir do primeiro), esquerda avanca; no ultimo capitulo a esquerda trava.
 */
export function resolveReadingSwipe(input: {
  direction: SwipeDirection;
  /** Indice do capitulo atual; -1 quando ainda nao ha capitulo selecionado. */
  chapterIndex: number;
  chapterCount: number;
}): ReadingSwipeResult {
  const { direction, chapterIndex, chapterCount } = input;
  if (chapterIndex < 0 || chapterCount === 0) return { type: "none" };

  if (direction === "left") {
    return chapterIndex + 1 < chapterCount
      ? { type: "chapter", index: chapterIndex + 1 }
      : { type: "none" };
  }

  return chapterIndex > 0
    ? { type: "chapter", index: chapterIndex - 1 }
    : { type: "project" };
}

/** Paginas que cuidam do proprio gesto (ou onde ele nao deve existir). */
const GLOBAL_SWIPE_EXCLUDED_PREFIXES = [
  "/projects",
  "/read",
  "/write",
  "/canvas",
];

/** O gesto global (voltar ao projeto) vale nas paginas secundarias. */
export function isGlobalSwipePath(pathname: string): boolean {
  return !GLOBAL_SWIPE_EXCLUDED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Destino do gesto global: so a direita navega, para a pagina do projeto
 * selecionado (ou para a lista, quando nao ha projeto aberto).
 */
export function globalSwipeHref(
  direction: SwipeDirection,
  projectId: string | null,
): string | null {
  if (direction === "left") return null;
  return projectId ? `/projects/${projectId}` : "/projects";
}