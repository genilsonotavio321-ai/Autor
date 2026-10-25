"use client";

import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import { Copy, Link2, Pencil, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { playUiSound } from "@/shared/lib/sound";
import type { IdeaCard } from "@/shared/types/database";

import { ideaCardRepository } from "../infra/dexie-idea-card-repository";

const CARD_COLORS: Record<string, string> = {
  yellow: "border-yellow-400/70 dark:border-yellow-500/40",
  green: "border-green-500/70 dark:border-green-500/40",
  blue: "border-sky-500/70 dark:border-sky-500/40",
  pink: "border-pink-500/70 dark:border-pink-500/40",
  purple: "border-purple-500/70 dark:border-purple-500/40",
};

/** Exclui o card para a lixeira com toast de Desfazer. */
export async function removeCard(card: IdeaCard) {
  await ideaCardRepository.softDelete(card.id);
  playUiSound("delete");
  toast(`"${card.title}" movido para a lixeira`, {
    action: {
      label: "Desfazer",
      onClick: () => {
        void ideaCardRepository.restore(card.id);
      },
    },
  });
}

interface IdeaCardViewProps {
  card: IdeaCard;
  linking: boolean;
  linkMode: boolean;
  selected: boolean;
  /** Deslocamento visual do drag (px de conteúdo) para todos os ids do lote. */
  dragOffset: { x: number; y: number } | null;
  /** Nome do grupo persistente do card, se houver (badge). */
  groupName?: string;
  /** pointerdown no card: o canvas decide tap, hold ou arraste. */
  onGestureDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  /** Teclado no card focado: Enter abre/conecta, setas movem, Delete exclui. */
  onCardKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onLink: () => void;
  onEdit: () => void;
  onSend: () => void;
  onDuplicate: () => void;
}

export function IdeaCardView({
  card,
  linking,
  linkMode,
  selected,
  dragOffset,
  groupName,
  onGestureDown,
  onCardKeyDown,
  onLink,
  onEdit,
  onSend,
  onDuplicate,
}: IdeaCardViewProps) {
  const style = {
    left: card.x,
    top: card.y,
    // O offset é compartilhado por todos os ids que arrastam juntos.
    transform: dragOffset
      ? `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)`
      : undefined,
    ...(dragOffset ? { zIndex: 10 } : {}),
  };

  return (
    <div
      data-card-id={card.id}
      data-dragging={dragOffset ? true : undefined}
      role="button"
      tabIndex={0}
      aria-label={`Ideia ${card.title}`}
      style={style}
      onPointerDown={onGestureDown}
      onKeyDown={onCardKeyDown}
      // transition-none: o MotionStyle global injeta transition-duration em *;
      // sem isso o transform do drag transiciona a cada pointermove (lag).
      className={`absolute w-56 cursor-grab touch-none rounded-lg border-2 bg-card p-3 shadow-sm transition-none select-none ${CARD_COLORS[card.color ?? "yellow"] ?? ""} ${selected ? "ring-2 ring-primary" : ""} ${dragOffset ? "opacity-70" : ""}`}
    >
      <p className="mb-1 min-w-0 break-words text-sm font-medium">
        {card.title}
      </p>
      {groupName ? (
        <p className="mb-1 truncate text-[10px] text-muted-foreground">
          {groupName}
        </p>
      ) : null}
      {card.content ? (
        <p className="mb-2 line-clamp-4 text-xs break-words whitespace-pre-wrap text-muted-foreground">
          {card.content}
        </p>
      ) : null}
      <div className="flex items-center gap-1">
        {card.sentSceneId ? (
          <Link
            href={`/outline?scene=${card.sentSceneId}`}
            onClick={(event) => event.stopPropagation()}
          >
            <Badge variant="outline" className="text-[10px]">
              → Cena
            </Badge>
          </Link>
        ) : null}
        <span className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          className={`size-7 ${linking ? "bg-accent text-accent-foreground" : ""}`}
          aria-label={
            linking
              ? `Cancelar conexão de ${card.title}`
              : linkMode
                ? `Conectar ${card.title} ao card selecionado`
                : `Conectar ${card.title} a outro card`
          }
          onClick={onLink}
        >
          <Link2 aria-hidden className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={`Editar ${card.title}`}
          onClick={onEdit}
        >
          <Pencil aria-hidden className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={`Transformar ${card.title} em cena`}
          onClick={onSend}
        >
          <Send aria-hidden className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={`Duplicar ${card.title}`}
          onClick={onDuplicate}
        >
          <Copy aria-hidden className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-destructive"
          aria-label={`Excluir ${card.title}`}
          onClick={() => void removeCard(card)}
        >
          <Trash2 aria-hidden className="size-4" />
        </Button>
      </div>
    </div>
  );
}
