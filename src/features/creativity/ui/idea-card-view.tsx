"use client";

import {
  useEffect,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import {
  BookOpen,
  Copy,
  Link2,
  MapPin,
  Pencil,
  Send,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { playUiSound } from "@/shared/lib/sound";
import type { IdeaCard, Json } from "@/shared/types/database";

import { ideaCardRepository } from "../infra/dexie-idea-card-repository";
import { CardDocEditor } from "./card-doc-editor";

const CARD_COLORS: Record<string, string> = {
  yellow: "border-yellow-400/70 dark:border-yellow-500/40",
  green: "border-green-500/70 dark:border-green-500/40",
  blue: "border-sky-500/70 dark:border-sky-500/40",
  pink: "border-pink-500/70 dark:border-pink-500/40",
  purple: "border-purple-500/70 dark:border-purple-500/40",
};

const COLOR_LABELS: Record<string, string> = {
  yellow: "Amarelo",
  green: "Verde",
  blue: "Azul",
  pink: "Rosa",
  purple: "Roxo",
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
  /** Edição inline aberta neste card (uma por vez). */
  editing: boolean;
  onEditEnd: () => void;
  /** Deslocamento visual do drag (px de conteúdo) para todos os ids do lote. */
  dragOffset: { x: number; y: number } | null;
  /** Nome do grupo persistente do card, se houver (badge). */
  groupName?: string;
  /** pointerdown no card: o canvas decide tap/hold/arraste. */
  onGestureDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  /** Teclado no card focado: Enter abre/conecta, setas movem, Delete exclui. */
  onCardKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  /** Tamanho ao vivo durante o arraste do grip (vence card.w/card.h). */
  liveSize: { w: number; h: number } | null;
  onLink: () => void;
  onEdit: () => void;
  onSend: () => void;
  onDuplicate: () => void;
  /** pointerdown na alça de conexão da borda direita. */
  onLinkHandleDown: (event: ReactPointerEvent<HTMLElement>) => void;
  /** pointerdown no grip de resize do canto inferior-direito. */
  onResizeHandleDown: (event: ReactPointerEvent<HTMLElement>) => void;
}

export function IdeaCardView({
  card,
  linking,
  linkMode,
  selected,
  editing,
  onEditEnd,
  dragOffset,
  groupName,
  onGestureDown,
  onCardKeyDown,
  liveSize,
  onLink,
  onEdit,
  onSend,
  onDuplicate,
  onLinkHandleDown,
  onResizeHandleDown,
}: IdeaCardViewProps) {
  const [title, setTitle] = useState(card.title);
  const [color, setColor] = useState(card.color ?? "yellow");
  const [doc, setDoc] = useState<Json | null>(null);
  const [plain, setPlain] = useState<string | null>(null);

  // Ao entrar na edição, descarta rascunhos da edição anterior.
  useEffect(() => {
    if (!editing) return;
    setTitle(card.title);
    setColor(card.color ?? "yellow");
    setDoc(null);
    setPlain(null);
    // Reset deliberado no toggle de `editing`, não a cada mudança de card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  // Autosave 800ms: título, cor e, se tocados, `doc` + espelho de texto.
  useEffect(() => {
    if (!editing) return;
    const timer = window.setTimeout(() => {
      void ideaCardRepository
        .update(card.id, {
          title,
          color,
          ...(doc !== null ? { doc, content: plain ?? "" } : {}),
        })
        .catch(() => toast.error("Falha ao salvar a ideia"));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [editing, card.id, title, color, doc, plain]);

  /** Sai salvando na hora: Esc/Ctrl+Enter persistem antes de fechar. */
  function flushEdit() {
    void ideaCardRepository
      .update(card.id, {
        title,
        color,
        ...(doc !== null ? { doc, content: plain ?? "" } : {}),
      })
      .catch(() => toast.error("Falha ao salvar a ideia"));
    onEditEnd();
  }

  function handleEditKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const isExit =
      event.key === "Escape" ||
      (event.key === "Enter" && (event.ctrlKey || event.metaKey));
    if (!isExit) return;
    event.preventDefault();
    // Não deixa o Esc vazar para a cadeia do canvas (conexão/seleção/foco).
    event.stopPropagation();
    flushEdit();
  }

  const style = {
    left: card.x,
    top: card.y,
    // O offset é compartilhado por todos os ids que arrastam juntos.
    transform: dragOffset
      ? `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)`
      : undefined,
    ...(dragOffset ? { zIndex: 10 } : {}),
    // Resize persistido (ou ao vivo no meio do grip) vence o w-56 padrão.
    ...(liveSize
      ? { width: liveSize.w, height: liveSize.h }
      : card.w !== undefined || card.h !== undefined
        ? { width: card.w ?? 224, height: card.h }
        : {}),
  };

  return (
    <div
      data-card-id={card.id}
      data-dragging={dragOffset ? true : undefined}
      role="button"
      tabIndex={editing ? -1 : 0}
      aria-label={`Ideia ${card.title}`}
      style={style}
      onPointerDown={(event) => {
        if (!editing) onGestureDown(event);
      }}
      onKeyDown={(event) => {
        if (editing) handleEditKeyDown(event);
        else onCardKeyDown(event);
      }}
      // transition-none: o MotionStyle global injeta transition-duration em *;
      // sem isso o transform do drag transiciona a cada pointermove (lag).
      className={`absolute w-56 cursor-grab touch-none rounded-lg border-2 bg-card p-3 shadow-sm transition-none select-none group ${CARD_COLORS[editing ? color : (card.color ?? "yellow")] ?? ""} ${selected ? "ring-2 ring-primary" : ""} ${dragOffset ? "opacity-70" : ""}`}
    >
      {!editing ? (
        <div
          role="toolbar"
          aria-label={`Ações de ${card.title}`}
          // Botões internos têm handler próprio; o gesto do card não engole.
          onPointerDown={(event) => event.stopPropagation()}
          className={`absolute -top-9 left-0 z-10 flex items-center gap-1 rounded-md border bg-card p-1 shadow-sm transition-none ${selected ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100"}`}
        >
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
            aria-label={
              card.refType
                ? `Abrir ficha ${card.title}`
                : `Editar ${card.title}`
            }
            onClick={onEdit}
          >
            {card.refType ? (
              <BookOpen aria-hidden className="size-4" />
            ) : (
              <Pencil aria-hidden className="size-4" />
            )}
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
      ) : null}
      {!editing ? (
        <>
          {/* shortcut: alças respondem só a ponteiro; teclado fica para quando doer. */}
          <button
            type="button"
            aria-label={`Conectar a partir de ${card.title}`}
            onPointerDown={onLinkHandleDown}
            className={`absolute top-1/2 -right-3 z-10 flex size-6 -translate-y-1/2 cursor-crosshair touch-none items-center justify-center rounded-full border bg-card shadow-sm transition-none ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"}`}
          >
            <Link2 aria-hidden className="size-3" />
          </button>
          <button
            type="button"
            aria-label={`Redimensionar ${card.title}`}
            onPointerDown={onResizeHandleDown}
            className={`absolute -right-1.5 -bottom-1.5 z-10 size-4 cursor-nwse-resize touch-none rounded-bl-md border-r-2 border-b-2 border-muted-foreground/50 bg-card transition-none ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"}`}
          />
        </>
      ) : null}
      {editing ? (
        <div
          className="grid gap-2"
          // Campos internos não iniciam o gesto do card.
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Input
            aria-label="Título da ideia"
            value={title}
            autoFocus
            onChange={(event) => setTitle(event.target.value)}
          />
          <div className="max-h-48 overflow-y-auto rounded-md border bg-background/50 p-2">
            <CardDocEditor
              content={card.doc ?? card.content}
              onChange={(nextDoc, nextPlain) => {
                setDoc(nextDoc);
                setPlain(nextPlain);
              }}
            />
          </div>
          <Select value={color} onValueChange={setColor}>
            <SelectTrigger aria-label="Cor da ideia" className="h-8 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(COLOR_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <>
          {card.refType ? (
            <div className="mb-1 flex items-center gap-1 text-muted-foreground">
              {card.refType === "character" ? (
                <User aria-hidden className="size-3.5" />
              ) : (
                <MapPin aria-hidden className="size-3.5" />
              )}
              <Badge variant="outline" className="text-[10px]">
                {card.refType === "character" ? "Personagem" : "Local"}
              </Badge>
            </div>
          ) : null}
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
          {card.sentSceneId ? (
            <div className="flex items-center gap-1">
              <Link
                href={`/outline?scene=${card.sentSceneId}`}
                onClick={(event) => event.stopPropagation()}
              >
                <Badge variant="outline" className="text-[10px]">
                  → Cena
                </Badge>
              </Link>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
