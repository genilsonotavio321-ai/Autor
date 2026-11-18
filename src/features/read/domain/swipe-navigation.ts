/**
 * Decisoes do deslize horizontal (celular). Fica fora dos componentes para
 * poder ser testado sem DOM: o hook so mede o gesto.
 */

export type SwipeDirection = "left" | "right";

export type ReadingSwipeResult =
  | { type: "chapter"; index: number }
  | { type: "none" };

/** Distancia minima do gesto, em px. */
export const SWIPE_MIN_DISTANCE = 60;
/** Gesto mais longo que isso e rolagem/leitura, nao navegacao. */
export const SWIPE_MAX_DURATION_MS = 800;
/** O deslocamento horizontal precisa dominar o vertical. */
export const SWIPE_DIRECTION_RATIO = 1.8;
/** Faixa da borda deixada para o "voltar" do sistema operacional. */
export const SWIPE_EDGE_GUARD_PX = 24;

/**
 * Limites do gesto: distancia minima, duracao maxima e dominio horizontal.
 * Devolve a direcao reconhecida ou `null` quando o toque nao e navegacao.
 */
export function resolveSwipeGesture(input: {
  dx: number;
  dy: number;
  durationMs: number;
}): SwipeDirection | null {
  const { dx, dy, durationMs } = input;
  if (durationMs > SWIPE_MAX_DURATION_MS) return null;
  if (Math.abs(dx) < SWIPE_MIN_DISTANCE) return null;
  if (Math.abs(dx) <= Math.abs(dy) * SWIPE_DIRECTION_RATIO) return null;
  return dx > 0 ? "right" : "left";
}

/**
 * Toque que comeca colado na borda pertence ao gesto do sistema (voltar).
 * Sem essa trava, o arrasto cancela a navegacao do app e alterna paginas.
 */
export function isEdgeTouch(
  clientX: number,
  viewportWidth: number,
): boolean {
  return (
    clientX <= SWIPE_EDGE_GUARD_PX ||
    clientX >= viewportWidth - SWIPE_EDGE_GUARD_PX
  );
}

/**
 * Deslize no modo leitura: esquerda avanca, direita volta. Nas duas pontas o
 * gesto trava — sair da leitura e papel de botao/link, nunca do deslize (era o
 * que empilhava historico e alimentava o vai-e-vem entre leitura e projeto).
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
    : { type: "none" };
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
