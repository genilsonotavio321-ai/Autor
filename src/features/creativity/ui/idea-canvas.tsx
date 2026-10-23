"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Link2, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { handleDialogEnter } from "@/shared/lib/keyboard";
import { playUiSound } from "@/shared/lib/sound";
import type { Chapter, EntityId, IdeaCard } from "@/shared/types/database";

import { sendSceneToOutline } from "../application/send-to-outline";
import { ideaCardRepository } from "../infra/dexie-idea-card-repository";

interface IdeaCanvasProps {
  projectId: EntityId;
  chapters: Chapter[];
}

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

/** Lista estável para o `??` do useLiveQuery (deps de useMemo/useLayoutEffect). */
const NO_CARDS: IdeaCard[] = [];

/** Board de cards com posição livre (x/y persistidos). */
export function IdeaCanvas({ projectId, chapters }: IdeaCanvasProps) {
  const cards =
    useLiveQuery(() => ideaCardRepository.listByProject(projectId), [
      projectId,
    ]) ?? NO_CARDS;
  const [editCard, setEditCard] = useState<IdeaCard | null>(null);
  const [sendCard, setSendCard] = useState<IdeaCard | null>(null);
  const [linkingFrom, setLinkingFrom] = useState<EntityId | null>(null);
  const [spacePanning, setSpacePanning] = useState(false);
  const [centers, setCenters] = useState<
    Record<EntityId, { x: number; y: number }>
  >({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    // KeyboardSensor padrão move 25px por tecla de seta.
    useSensor(KeyboardSensor),
  );

  // Drag do dnd-kit ativo: com 2 dedos, o pan não age (o 1º dedo no grip
  // já começou um arraste de card).
  const activeDragRef = useRef<string | number | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const hasCards = cards.length > 0;

  /** Pares únicos de cards conectados (card na lixeira some sozinho). */
  const pairs = useMemo(() => {
    const byId = new Map(cards.map((card) => [card.id, card]));
    const seen = new Set<string>();
    const result: Array<[IdeaCard, IdeaCard]> = [];
    for (const card of cards) {
      for (const linkedId of card.links ?? []) {
        const other = byId.get(linkedId);
        if (!other) continue;
        const key = [card.id, linkedId].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        result.push([card, other]);
      }
    }
    return result;
  }, [cards]);

  // shortcut: âncoras medidas só quando `cards` muda; troca tardia de fonte
  // pode deslocar as linhas até o próximo update — ResizeObserver se incomodar.
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const base = content.getBoundingClientRect();
    const next: Record<EntityId, { x: number; y: number }> = {};
    for (const element of content.querySelectorAll<HTMLElement>(
      "[data-card-id]",
    )) {
      const rect = element.getBoundingClientRect();
      next[element.dataset.cardId!] = {
        x: rect.left - base.left + rect.width / 2,
        y: rect.top - base.top + rect.height / 2,
      };
    }
    setCenters((prev) => (sameCenters(prev, next) ? prev : next));
  }, [cards]);

  // Pan com espaço (desktop): keydown/keyup globais, fora de campos de texto.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      const element = event.target as HTMLElement | null;
      if (
        element &&
        (element.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName))
      ) {
        return;
      }
      // Evita scroll da página e clique acidental em botões pelo espaço.
      event.preventDefault();
      setSpacePanning(true);
    };
    const stop = () => setSpacePanning(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", stop);
    window.addEventListener("blur", stop);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", stop);
      window.removeEventListener("blur", stop);
    };
  }, []);

  // Enquanto o espaço está pressionado, mousedown em qualquer lugar do board
  // vira pan — inclusive sobre cards (preventDefault cancela o clique).
  useEffect(() => {
    if (!spacePanning) return;
    const board = boardRef.current;
    if (!board) return;
    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      let last = { x: event.clientX, y: event.clientY };
      const onMouseMove = (move: MouseEvent) => {
        board.scrollLeft -= move.clientX - last.x;
        board.scrollTop -= move.clientY - last.y;
        last = { x: move.clientX, y: move.clientY };
      };
      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    };
    board.addEventListener("mousedown", onMouseDown);
    return () => board.removeEventListener("mousedown", onMouseDown);
  }, [spacePanning]);

  // Pan com 2 dedos (mobile); 1 dedo segue o scroll nativo.
  useEffect(() => {
    if (!hasCards) return;
    const board = boardRef.current;
    if (!board) return;
    let last: { x: number; y: number } | null = null;
    const onTouchStart = (event: TouchEvent) => {
      last =
        event.touches.length === 2 && !activeDragRef.current
          ? touchMidpoint(event.touches)
          : null;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || !last || activeDragRef.current) return;
      event.preventDefault();
      const next = touchMidpoint(event.touches);
      board.scrollLeft -= next.x - last.x;
      board.scrollTop -= next.y - last.y;
      last = next;
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) last = null;
    };
    board.addEventListener("touchstart", onTouchStart, { passive: false });
    board.addEventListener("touchmove", onTouchMove, { passive: false });
    board.addEventListener("touchend", onTouchEnd);
    return () => {
      board.removeEventListener("touchstart", onTouchStart);
      board.removeEventListener("touchmove", onTouchMove);
      board.removeEventListener("touchend", onTouchEnd);
    };
  }, [hasCards]);

  // Esc cancela o modo de conexão.
  useEffect(() => {
    if (!linkingFrom) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLinkingFrom(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [linkingFrom]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, delta } = event;
    if (!delta || (delta.x === 0 && delta.y === 0)) return;
    const card = cards.find((item) => item.id === active.id);
    if (!card) return;
    try {
      await ideaCardRepository.move(card.id, card.x + delta.x, card.y + delta.y);
    } catch {
      toast.error("Falha ao mover a ideia");
    }
  }

  async function createCard() {
    // Novos cards entram em cascata no canto do canvas.
    const n = cards.length;
    try {
      const card = await ideaCardRepository.create({
        projectId,
        x: 16 + (n % 5) * 24,
        y: 16 + (n % 5) * 40,
      });
      setEditCard(card);
    } catch {
      toast.error("Falha ao criar a ideia");
    }
  }

  async function toggleLink(card: IdeaCard) {
    if (linkingFrom === card.id) {
      setLinkingFrom(null);
      return;
    }
    if (!linkingFrom) {
      setLinkingFrom(card.id);
      return;
    }
    try {
      await ideaCardRepository.link(linkingFrom, card.id);
      toast.success("Conexão criada");
    } catch {
      toast.error("Falha ao criar a conexão");
    }
    setLinkingFrom(null);
  }

  async function removeLink(a: IdeaCard, b: IdeaCard) {
    try {
      await ideaCardRepository.unlink(a.id, b.id);
      toast("Conexão removida", {
        action: {
          label: "Desfazer",
          onClick: () => {
            void ideaCardRepository.link(a.id, b.id);
          },
        },
      });
    } catch {
      toast.error("Falha ao remover a conexão");
    }
  }

  // Conteúdo com tamanho explícito: o SVG cobre todo o espaço scrollável
  // até o último card (largura do card = 224px + folga).
  const boardWidth = Math.max(...cards.map((card) => card.x + 280));
  const boardHeight = Math.max(480, ...cards.map((card) => card.y + 180));
  const linkingTitle = cards.find((card) => card.id === linkingFrom)?.title;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void createCard()}>
          <Plus aria-hidden />
          Nova ideia
        </Button>
        <p className="text-xs text-muted-foreground">
          Espaço + arraste (ou dois dedos) move o canvas
        </p>
      </div>
      {cards.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma ideia no canvas ainda. Use o desbloqueio ou crie um card.
        </div>
      ) : (
        <>
          {linkingTitle ? (
            <p className="text-xs text-muted-foreground">
              Conectando “{linkingTitle}” — clique no ícone de link do card
              destino (Esc cancela)
            </p>
          ) : null}
          <DndContext
            sensors={spacePanning ? [] : sensors}
            collisionDetection={() => []}
            onDragStart={(event) => {
              activeDragRef.current = event.active.id;
            }}
            onDragEnd={(event) => {
              activeDragRef.current = null;
              void handleDragEnd(event);
            }}
            onDragCancel={() => {
              activeDragRef.current = null;
            }}
          >
            <div
              ref={boardRef}
              className={`relative min-h-[480px] overflow-auto rounded-lg border bg-muted/30 ${spacePanning ? "cursor-grab" : ""}`}
            >
              <div
                ref={contentRef}
                className="relative transition-none"
                style={{ width: boardWidth, height: boardHeight }}
              >
                <svg className="pointer-events-none absolute inset-0 h-full w-full transition-none">
                  {pairs.map(([a, b]) => {
                    const from = centers[a.id];
                    const to = centers[b.id];
                    if (!from || !to) return null;
                    const points = {
                      x1: from.x,
                      y1: from.y,
                      x2: to.x,
                      y2: to.y,
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
                          onClick={() => void removeLink(a, b)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") void removeLink(a, b);
                          }}
                        />
                      </g>
                    );
                  })}
                </svg>
                {cards.map((card) => (
                  <IdeaCardView
                    key={card.id}
                    card={card}
                    linking={linkingFrom === card.id}
                    linkMode={linkingFrom !== null}
                    onLink={() => void toggleLink(card)}
                    onEdit={() => setEditCard(card)}
                    onSend={() => setSendCard(card)}
                  />
                ))}
              </div>
            </div>
          </DndContext>
        </>
      )}

      <EditCardDialog
        card={editCard}
        open={editCard !== null}
        onOpenChange={(open) => {
          if (!open) setEditCard(null);
        }}
      />
      <SendCardDialog
        card={sendCard}
        chapters={chapters}
        open={sendCard !== null}
        onOpenChange={(open) => {
          if (!open) setSendCard(null);
        }}
      />
    </div>
  );
}

function sameCenters(
  a: Record<EntityId, { x: number; y: number }>,
  b: Record<EntityId, { x: number; y: number }>,
): boolean {
  const keys = Object.keys(b);
  if (Object.keys(a).length !== keys.length) return false;
  return keys.every(
    (key) => a[key]?.x === b[key]?.x && a[key]?.y === b[key]?.y,
  );
}

function touchMidpoint(touches: TouchList): { x: number; y: number } {
  return {
    x: (touches[0]!.clientX + touches[1]!.clientX) / 2,
    y: (touches[0]!.clientY + touches[1]!.clientY) / 2,
  };
}

async function removeCard(card: IdeaCard) {
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
  onLink: () => void;
  onEdit: () => void;
  onSend: () => void;
}

function IdeaCardView({
  card,
  linking,
  linkMode,
  onLink,
  onEdit,
  onSend,
}: IdeaCardViewProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: card.id });
  const style = {
    left: card.x,
    top: card.y,
    transform: CSS.Translate.toString(transform),
    ...(isDragging ? { zIndex: 10 } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      data-card-id={card.id}
      style={style}
      // transition-none: o MotionStyle global injeta transition-duration em *;
      // sem isso o transform do drag transiciona a cada pointermove (lag).
      className={`absolute w-56 rounded-lg border-2 bg-card p-3 shadow-sm transition-none ${CARD_COLORS[card.color ?? "yellow"] ?? ""} ${isDragging ? "opacity-70" : ""}`}
    >
      <div className="mb-1 flex items-start gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Mover ${card.title}`}
          className="inline-flex size-5 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <GripVertical aria-hidden className="size-4" />
        </button>
        <p className="min-w-0 flex-1 break-words text-sm font-medium">
          {card.title}
        </p>
      </div>
      {card.content ? (
        <p className="mb-2 line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground">
          {card.content}
        </p>
      ) : null}
      <div className="flex items-center gap-1">
        {card.sentSceneId ? (
          <Link href="/outline">
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

interface EditCardDialogProps {
  card: IdeaCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function EditCardDialog({ card, open, onOpenChange }: EditCardDialogProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState("yellow");

  useEffect(() => {
    if (!open || !card) return;
    setTitle(card.title);
    setContent(card.content);
    setColor(card.color ?? "yellow");
  }, [open, card]);

  async function save() {
    if (!card) return;
    try {
      await ideaCardRepository.update(card.id, {
        title: title.trim() || card.title,
        content,
        color,
      });
      onOpenChange(false);
    } catch {
      toast.error("Falha ao salvar a ideia");
    }
  }

  async function remove() {
    if (!card) return;
    await removeCard(card);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onKeyDown={(event) => handleDialogEnter(event, () => void save())}
      >
        <DialogHeader>
          <DialogTitle>Editar ideia</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="idea-title">Título</Label>
            <Input
              id="idea-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="idea-content">Conteúdo</Label>
            <Textarea
              id="idea-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={5}
            />
          </div>
          <div className="grid gap-2">
            <Label>Cor</Label>
            <Select value={color} onValueChange={setColor}>
              <SelectTrigger aria-label="Cor do card" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(COLOR_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={() => void remove()}
            >
              <Trash2 aria-hidden />
              Excluir
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void save()}>Salvar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SendCardDialogProps {
  card: IdeaCard | null;
  chapters: Chapter[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Transforma o card em cena: escolhe o capítulo e envia para a Estrutura. */
function SendCardDialog({ card, chapters, open, onOpenChange }: SendCardDialogProps) {
  const router = useRouter();
  const [chapterId, setChapterId] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChapterId(chapters[0]?.id ?? "");
  }, [open, chapters]);

  async function submit() {
    if (!card || !chapterId) return;
    setSending(true);
    try {
      const scene = await sendSceneToOutline({
        chapterId,
        title: card.title,
        summary: card.content || undefined,
      });
      await ideaCardRepository.update(card.id, { sentSceneId: scene.id });
      toast.success(`Cena "${scene.title}" criada na Estrutura`, {
        action: {
          label: "Ver em Estrutura",
          onClick: () => router.push("/outline"),
        },
      });
      onOpenChange(false);
    } catch {
      toast.error("Falha ao criar a cena");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onKeyDown={(event) => handleDialogEnter(event, () => void submit())}
      >
        <DialogHeader>
          <DialogTitle>Transformar em cena</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            A ideia será enviada como cena para o capítulo escolhido na
            Estrutura.
          </p>
          <div className="grid gap-2">
            <Label>Capítulo</Label>
            <Select value={chapterId} onValueChange={setChapterId}>
              <SelectTrigger aria-label="Capítulo destino">
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                {chapters.map((chapter) => (
                  <SelectItem key={chapter.id} value={chapter.id}>
                    {chapter.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={sending || !chapterId}
          >
            Criar cena
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
