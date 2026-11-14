import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { UniqueIdentifier } from "@dnd-kit/core";

/**
 * `useSortable` com o "abre espaço" congelado: só o card arrastado se move, o
 * alvo não foge do ponteiro (soltar no centro fica fácil).
 */
export function useCardSortable(
  id: UniqueIdentifier,
  data?: Record<string, unknown>,
) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id, data });

  return {
    setNodeRef,
    dragProps: { ...attributes, ...listeners },
    style: {
      transform: isDragging ? CSS.Transform.toString(transform) : undefined,
      transition,
    },
    isDragging,
    isOver,
  };
}

/** Opacidade do card enquanto ele está sendo arrastado. */
export function dragOpacity(isDragging: boolean): string {
  return isDragging ? "opacity-60" : "";
}
