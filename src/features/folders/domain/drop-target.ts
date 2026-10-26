export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Decide o efeito de soltar um card sobre outro: "into" quando o centro do
 * card ativo cai na zona central (~40%) do card alvo (criar pasta / mover
 * para dentro); fora dela é reordenação — o comportamento de arrastar antigo.
 */
export function resolveDrop(
  activeRect: RectLike | null,
  overRect: RectLike | null,
): "into" | "reorder" {
  if (!activeRect || !overRect) return "reorder";
  const centerX = activeRect.left + activeRect.width / 2;
  const centerY = activeRect.top + activeRect.height / 2;
  const marginX = overRect.width * 0.3;
  const marginY = overRect.height * 0.3;
  const insideX =
    centerX >= overRect.left + marginX &&
    centerX <= overRect.left + overRect.width - marginX;
  const insideY =
    centerY >= overRect.top + marginY &&
    centerY <= overRect.top + overRect.height - marginY;
  return insideX && insideY ? "into" : "reorder";
}
