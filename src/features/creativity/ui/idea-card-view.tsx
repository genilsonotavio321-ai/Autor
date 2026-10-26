"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import { generateHTML, type JSONContent } from "@tiptap/core";
import TextAlign from "@tiptap/extension-text-align";
import StarterKit from "@tiptap/starter-kit";
import { Link2, MapPin, User } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { playUiSound } from "@/shared/lib/sound";
import type { IdeaCard, Json } from "@/shared/types/database";

import { titleFromPlain } from "../domain/card-title";
import { ideaCardRepository } from "../infra/dexie-idea-card-repository";
import { CardDocEditor } from "./card-doc-editor";

const CARD_COLORS: Record<string, string> = {
  yellow: "border-yellow-400/70 dark:border-yellow-500/40",
  green: "border-green-500/70 dark:border-green-500/40",
  blue: "border-sky-500/70 dark:border-sky-500/40",
  pink: "border-pink-500/70 dark:border-pink-500/40",
  purple: "border-purple-500/70 dark:border-purple-500/40",
};

/** Extensões do display: as mesmas do editor, para renderizar o `doc`. */
const DISPLAY_EXTENSIONS = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
];

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

const LINK_SIDES = ["top", "right", "bottom", "left"] as const;

const LINK_SIDE_LABEL: Record<(typeof LINK_SIDES)[number], string> = {
  top: "topo",
  right: "direita",
  bottom: "baixo",
  left: "esquerda",
};

// Alças no meio de cada aresta, 14px para dentro (o root tem overflow-hidden:
// fora da borda o handle seria cortado).
const LINK_ANCHOR: Record<
  (typeof LINK_SIDES)[number],
  { left: string; top: string }
> = {
  top: { left: "50%", top: "14px" },
  right: { left: "calc(100% - 14px)", top: "50%" },
  bottom: { left: "50%", top: "calc(100% - 14px)" },
  left: { left: "14px", top: "50%" },
};

interface IdeaCardViewProps {
  card: IdeaCard;
  selected: boolean;
  /** Zoom atual do canvas: as alças de link compensam o tamanho. */
  zoom: number;
  /** Edição inline aberta neste card (uma por vez). */
  editing: boolean;
  onEditEnd: () => void;
  /** Deslocamento visual do drag (px de conteúdo) para todos os ids do lote. */
  dragOffset: { x: number; y: number } | null;
  /** Nome do grupo persistente do card, se houver (badge). */
  groupName?: string;
  /** pointerdown no card: o canvas decide tap/hold/arraste. */
  onGestureDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  /** Teclado no card focado: Enter abre, setas movem, Delete exclui. */
  onCardKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  /** Tamanho ao vivo durante o arraste do grip (vence card.w/card.h). */
  liveSize: { w: number; h: number } | null;
  /** pointerdown numa alça de conexão (4 arestas). */
  onLinkHandleDown: (event: ReactPointerEvent<HTMLElement>) => void;
  /** pointerdown no grip de resize do canto inferior-direito. */
  onResizeHandleDown: (event: ReactPointerEvent<HTMLElement>) => void;
}

export function IdeaCardView({
  card,
  selected,
  zoom,
  editing,
  onEditEnd,
  dragOffset,
  groupName,
  onGestureDown,
  onCardKeyDown,
  liveSize,
  onLinkHandleDown,
  onResizeHandleDown,
}: IdeaCardViewProps) {
  const [doc, setDoc] = useState<Json | null>(null);
  const [plain, setPlain] = useState<string | null>(null);

  // Ao entrar na edição, descarta rascunhos da edição anterior.
  useEffect(() => {
    if (!editing) return;
    setDoc(null);
    setPlain(null);
    // Reset deliberado no toggle de `editing`, não a cada mudança de card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  // Autosave 800ms: título derivado + doc + espelho de texto.
  useEffect(() => {
    if (!editing || doc === null) return;
    const timer = window.setTimeout(() => {
      void ideaCardRepository
        .update(card.id, {
          title: titleFromPlain(plain ?? ""),
          doc,
          content: plain ?? "",
        })
        .catch(() => toast.error("Falha ao salvar a ideia"));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [editing, card.id, doc, plain]);

  /** Sai salvando na hora: Esc/Ctrl+Enter persistem antes de fechar. */
  const flushEdit = useCallback(() => {
    if (doc !== null) {
      void ideaCardRepository
        .update(card.id, {
          title: titleFromPlain(plain ?? ""),
          doc,
          content: plain ?? "",
        })
        .catch(() => toast.error("Falha ao salvar a ideia"));
    }
    onEditEnd();
  }, [card.id, doc, plain, onEditEnd]);

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

  const style: CSSProperties = {
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
    // Cor RGB escolhida no menu do card vira borda direto (paleta usa classe).
    ...(card.color?.startsWith("#") ? { borderColor: card.color } : {}),
  };

  const rootRef = useRef<HTMLDivElement | null>(null);

  // Clicar fora do node em edição salva e fecha (correção 6).
  useEffect(() => {
    if (!editing) return;
    const onPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        rootRef.current?.contains(event.target)
      ) {
        return;
      }
      flushEdit();
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [editing, flushEdit]);

  // Display do corpo rico: renderiza o `doc` sem instância de editor por card.
  const html = useMemo(
    () =>
      card.doc
        ? generateHTML(card.doc as JSONContent, DISPLAY_EXTENSIONS)
        : null,
    [card.doc],
  );

  // Alças de link compensam o zoom: afastado ficam maiores na tela (fáceis
  // de pegar), ampliado menores. (1/zoom)^1,5 com limites.
  const linkScale = Math.min(2.4, Math.max(0.6, 1 / zoom ** 1.5));

  return (
    <div
      ref={rootRef}
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
      // flex-col + overflow-hidden: o texto acompanha o redimensionamento.
      className={`absolute flex w-56 cursor-grab touch-none flex-col overflow-hidden rounded-lg border-2 bg-card p-3 shadow-sm transition-none select-none group ${CARD_COLORS[card.color ?? "yellow"] ?? ""} ${selected ? "ring-2 ring-primary" : ""} ${dragOffset ? "opacity-70" : ""}`}
    >

      {!editing ? (
        <>
          {/* shortcut: alças respondem só a ponteiro; teclado fica para quando doer. */}
          {LINK_SIDES.map((side) => (
            <button
              key={side}
              type="button"
              aria-label={`Conectar ${card.title} pelo ${LINK_SIDE_LABEL[side]}`}
              onPointerDown={onLinkHandleDown}
              style={{
                ...LINK_ANCHOR[side],
                transform: `translate(-50%, -50%) scale(${linkScale})`,
              }}
              className={`absolute z-10 flex size-5 cursor-crosshair touch-none items-center justify-center rounded-full border border-background bg-primary text-primary-foreground shadow transition-none ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"}`}
            >
              <Link2 aria-hidden className="size-2.5" />
            </button>
          ))}
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
          className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-background/50 p-2"
          // Campos internos não iniciam o gesto do card.
          onPointerDown={(event) => event.stopPropagation()}
        >
          <CardDocEditor
            content={
              card.doc ??
              (card.content ? `${card.title}\n\n${card.content}` : "")
            }
            onChange={(nextDoc, nextPlain) => {
              setDoc(nextDoc);
              setPlain(nextPlain);
            }}
          />
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
          {groupName ? (
            <p className="mb-1 truncate text-[10px] text-muted-foreground">
              {groupName}
            </p>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {html ? (
              <div
                className="card-doc text-sm break-words"
                // HTML gerado pelo generateHTML a partir do próprio JSON
                // do app (doc Tiptap) — não é entrada externa.
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <>
                <p className="mb-1 min-w-0 break-words text-sm font-medium">
                  {card.title}
                </p>
                {card.content ? (
                  <p className="mb-2 text-xs break-words whitespace-pre-wrap text-muted-foreground">
                    {card.content}
                  </p>
                ) : null}
              </>
            )}
          </div>
          {card.sentSceneId ? (
            <div className="mt-1 flex items-center gap-1">
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
