/** Limite do título derivado do corpo do card (exibe em toasts/quadros). */
const TITLE_MAX_CHARS = 60;

/**
 * Título do card = 1ª linha não vazia do texto plano do `doc` (cap 60 chars).
 * O card é corpo único agora; o título existe para busca, ária e listas.
 */
export function titleFromPlain(plain: string): string {
  const line = plain
    .split("\n")
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.length > 0);
  if (!line) return "Sem título";
  if (line.length <= TITLE_MAX_CHARS) return line;
  return `${line.slice(0, TITLE_MAX_CHARS).trimEnd()}…`;
}
