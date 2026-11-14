"use client";

import type { KeyboardEvent, PointerEvent, RefObject } from "react";

import type { EntityId, IdeaCard } from "@/shared/types/database";

import { rectCenter, type CardRect, type Marquee } from "./canvas-geometry";
import { IdeaCardView } from "./idea-card-view";

interface CanvasBoardProps {
  boardRef: RefObject<HTMLDivElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  cards: IdeaCard[];
  zoom: number;
  boardWidth: number;
  boardHeight: number;
  /** Pares de cards conectados (linhas desenhadas entre eles). */
  pairs: [IdeaCard, IdeaCard][];
  rects: Record<EntityId, CardRect>;
  linkDrag: { fromId: EntityId; x: number; y: number } | null;
  marquee: Marquee | null;
  selection: Set<EntityId>;
  editingId: EntityId | null;
  dragDelta: { ids: EntityId[]; x: number; y: number } | null;
  resize: { id: EntityId; w: number; h: number } | null;
  groupNames: Map<EntityId, string>;
  onEditEnd: () => void;
  onRemoveLink: (a: IdeaCard, b: IdeaCard) => void;
  onLinkHandleDown: (event: PointerEvent<HTMLElement>, card: IdeaCard) => void;
  onResizeHandleDown: (event: PointerEvent<HTMLElement>, card: IdeaCard) => void;
  onGestureDown: (event: PointerEvent<HTMLDivElement>, card: IdeaCard) => void;
  onCardKeyDown: (event: KeyboardEvent<HTMLDivElement>, card: IdeaCard) => void;
}

/** Superfície rolável do canvas: fundo, conexões, marquee e cards. */
export function CanvasBoard({
  boardRef,
  contentRef,
  cards,
  zoom,
  boardWidth,
  boardHeight,
  pairs,
  rects,
  linkDrag,
  marquee,
  selection,
  editingId,
  dragDelta,
  resize,
  groupNames,
  onEditEnd,
  onRemoveLink,
  onLinkHandleDown,
  onResizeHandleDown,
  onGestureDown,
  onCardKeyDown,
}: CanvasBoardProps) {
  /** Endpoint da linha durante o drag: acompanha o card em tempo real. */
  function linePoint(cardId: EntityId, center: { x: number; y: number }) {
    if (!dragDelta || !dragDelta.ids.includes(cardId)) return center;
    return {
      x: center.x + dragDelta.x / zoom,
      y: center.y + dragDelta.y / zoom,
    };
  }

  return (
    <div
      ref={boardRef}
      data-slot="canvas-board"
      className="relative flex-1 cursor-grab overflow-auto rounded-2xl border-border/70 bg-muted/30 touch-none"
    >
      {cards.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-muted-foreground">
          Nenhuma ideia ainda. Use o menu no canto superior direito.
        </div>
      ) : null}

      <div
        ref={contentRef}
        className="relative transition-none"
        style={{ width: boardWidth * zoom, height: boardHeight * zoom }}
      >
        <div
          className="absolute top-0 left-0 transition-none"
          style={{
            width: boardWidth,
            height: boardHeight,
            transform: `scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          <svg className="pointer-events-none absolute inset-0 h-full w-full transition-none">
            {pairs.map(([a, b]) => {
              const from = rects[a.id];
              const to = rects[b.id];
              if (!from || !to) return null;
              const fromPoint = linePoint(a.id, rectCenter(from));
              const toPoint = linePoint(b.id, rectCenter(to));
              const points = {
                x1: fromPoint.x,
                y1: fromPoint.y,
                x2: toPoint.x,
                y2: toPoint.y,
              };
              return (
                <g key={`${a.id}|${b.id}`}>
                  <line
                    {...points}
                    strokeWidth={2}
                    className="pointer-events-none transition-none stroke-muted-foreground/40"
                  />
                  <line
                    {...points}
                    stroke="transparent"
                    strokeWidth={14}
                    role="button"
                    tabIndex={0}
                    aria-label={`Remover conexão entre ${a.title} e ${b.title}`}
                    className="pointer-events-auto cursor-pointer transition-none"
                    onClick={() => void onRemoveLink(a, b)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void onRemoveLink(a, b);
                    }}
                  />
                </g>
              );
            })}
            {linkDrag
              ? (() => {
                  const from = rects[linkDrag.fromId];
                  if (!from) return null;
                  const center = rectCenter(from);
                  return (
                    <line
                      x1={center.x}
                      y1={center.y}
                      x2={linkDrag.x}
                      y2={linkDrag.y}
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      className="pointer-events-none transition-none stroke-primary"
                    />
                  );
                })()
              : null}
          </svg>

          {marquee ? (
            <div
              className="pointer-events-none absolute z-10 border border-dashed border-primary bg-primary/10 transition-none"
              style={{
                left: Math.min(marquee.x0, marquee.x1),
                top: Math.min(marquee.y0, marquee.y1),
                width: Math.abs(marquee.x1 - marquee.x0),
                height: Math.abs(marquee.y1 - marquee.y0),
              }}
            />
          ) : null}

          {cards.map((card) => (
            <IdeaCardView
              key={card.id}
              card={card}
              zoom={zoom}
              selected={selection.has(card.id)}
              editing={editingId === card.id}
              onEditEnd={onEditEnd}
              dragOffset={
                dragDelta && dragDelta.ids.includes(card.id)
                  ? { x: dragDelta.x / zoom, y: dragDelta.y / zoom }
                  : null
              }
              groupName={card.groupId ? groupNames.get(card.groupId) : undefined}
              liveSize={
                resize?.id === card.id ? { w: resize.w, h: resize.h } : null
              }
              onLinkHandleDown={(event) => onLinkHandleDown(event, card)}
              onResizeHandleDown={(event) => onResizeHandleDown(event, card)}
              onGestureDown={(event) => onGestureDown(event, card)}
              onCardKeyDown={(event) => onCardKeyDown(event, card)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
