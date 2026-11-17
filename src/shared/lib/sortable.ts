import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Announcements, UniqueIdentifier } from "@dnd-kit/core";

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

/**
 * Anúncios para leitores de tela num arraste dnd-kit. O texto é contrato dos
 * testes E2E, então vive num lugar só.
 */
export function buildAnnouncements(
  labels: Map<UniqueIdentifier, string>,
  fallback: string,
): Announcements {
  const labelFor = (id: UniqueIdentifier) => labels.get(id) ?? fallback;
  return {
    onDragStart: ({ active }) => `Arrastando ${labelFor(active.id)}.`,
    onDragOver: ({ over }) =>
      over ? `Sobre ${labelFor(over.id)}.` : "Fora de um destino.",
    onDragEnd: ({ over }) =>
      over ? `Solto sobre ${labelFor(over.id)}.` : "Fora de um destino.",
    onDragCancel: () => "Arraste cancelado.",
  };
}
