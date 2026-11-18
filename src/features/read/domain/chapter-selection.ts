/**
 * Próximo capítulo a exibir no modo leitura.
 *
 * - `undefined`: nenhuma decisão (carregando ou a seleção atual é válida).
 * - `string`: capítulo escolhido.
 * - `null`: o projeto não tem capítulos.
 *
 * Um capítulo que não pertence à lista atual é descartado em favor do primeiro
 * do projeto — nunca se tenta recuperar o capítulo de outro projeto, que era o
 * que fazia a leitura alternar entre dois projetos.
 */
export function nextReadChapterId(input: {
  loading: boolean;
  chapterIds: string[];
  currentChapterId: string | null;
}): string | null | undefined {
  if (input.loading) return undefined;
  if (
    input.currentChapterId &&
    input.chapterIds.includes(input.currentChapterId)
  ) {
    return undefined;
  }
  return input.chapterIds[0] ?? null;
}
