"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import {
  AlignHorizontalJustifyCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalJustifyCenter,
  Download,
  Group,
  MapPin,
  Maximize2,
  Minimize2,
  MousePointerSquareDashed,
  Plus,
  Redo2,
  Save,
  Trash2,
  Undo2,
  Ungroup,
  Upload,
  User,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { handleDialogEnter } from "@/shared/lib/keyboard";
import { playUiSound } from "@/shared/lib/sound";
import { useUiStore } from "@/shared/store/ui-store";
import type {
  Chapter,
  Character,
  EntityId,
  IdeaBoard,
  IdeaBoardItem,
  IdeaCard,
  IdeaGroup,
  Location,
} from "@/shared/types/database";

import { sendSceneToOutline } from "../application/send-to-outline";
import { buildBoardExport, parseBoardExport } from "../domain/board-io";
import {
  cardAtPoint,
  createGestureTracker,
  dragIdsFor,
  type GesturePoint,
  type GestureTracker,
} from "../domain/canvas-gesture";
import {
  alignLeft,
  alignTop,
  distributeHorizontally,
  distributeVertically,
  type LayoutMove,
} from "../domain/canvas-layout";
import { characterRepository } from "@/features/characters/infra/dexie-character-repository";
import { MentionSheet, type MentionSheetTarget } from "@/features/editor/ui/mention-sheet";
import { downloadBlob } from "@/features/export/infra/download";
import { locationRepository } from "@/features/world/infra/dexie-location-repository";
import { ideaBoardRepository } from "../infra/dexie-idea-board-repository";
import { ideaCardRepository } from "../infra/dexie-idea-card-repository";
import { ideaGroupRepository } from "../infra/dexie-idea-group-repository";

import { IdeaCardView, removeCard } from "./idea-card-view";

interface IdeaCanvasProps {
  projectId: EntityId;
  chapters: Chapter[];
}


/** Lista estável para o `??` do useLiveQuery (deps de useMemo/useLayoutEffect). */
const NO_CARDS: IdeaCard[] = [];
const NO_GROUPS: IdeaGroup[] = [];
const NO_BOARDS: IdeaBoard[] = [];
const NO_CHARACTERS: Character[] = [];
const NO_LOCATIONS: Location[] = [];

/** Uma mudança de posição (desfazer/refazer de movimento). */
type MoveOp = {
  id: EntityId;
  from: { x: number; y: number };
  to: { x: number; y: number };
};

/** Retângulo de um card no espaço do conteúdo (pré-escala do zoom). */
type CardRect = { x: number; y: number; width: number; height: number };

/** Marquee de seleção em coordenadas do conteúdo. */
type Marquee = { x0: number; y0: number; x1: number; y1: number };

/** Board de cards com posição livre (x/y persistidos). */
export function IdeaCanvas({ projectId, chapters }: IdeaCanvasProps) {
  const cards =
    useLiveQuery(() => ideaCardRepository.listByProject(projectId), [
      projectId,
    ]) ?? NO_CARDS;
  const groups =
    useLiveQuery(() => ideaGroupRepository.listByProject(projectId), [
      projectId,
    ]) ?? NO_GROUPS;
  const boards =
    useLiveQuery(() => ideaBoardRepository.listByProject(projectId), [
      projectId,
    ]) ?? NO_BOARDS;
  const characters =
    useLiveQuery(() => characterRepository.listByProject(projectId), [
      projectId,
    ]) ?? NO_CHARACTERS;
  const locations =
    useLiveQuery(() => locationRepository.listByProject(projectId), [
      projectId,
    ]) ?? NO_LOCATIONS;
  const router = useRouter();
  const [editingId, setEditingId] = useState<EntityId | null>(null);
  const [fichaDialogOpen, setFichaDialogOpen] = useState(false);
  const [fichaTarget, setFichaTarget] = useState<MentionSheetTarget | null>(
    null,
  );
  const [sendCard, setSendCard] = useState<IdeaCard | null>(null);
  const [linkingFrom, setLinkingFrom] = useState<EntityId | null>(null);
  const [spacePanning, setSpacePanning] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [dragDelta, setDragDelta] = useState<{
    ids: EntityId[];
    x: number;
    y: number;
  } | null>(null);
  const [rects, setRects] = useState<Record<EntityId, CardRect>>({});
  // shortcut: histórico de posições em memória (perde ao recarregar); snapshot
  // persistido fica para os quadros salvos se incomodar.
  const [undoStack, setUndoStack] = useState<MoveOp[][]>([]);
  const [redoStack, setRedoStack] = useState<MoveOp[][]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selection, setSelection] = useState<Set<EntityId>>(new Set());
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [boardName, setBoardName] = useState("");
  /** Quadro aguardando confirmação de "Carregar" (substitui o canvas). */
  const [confirmBoard, setConfirmBoard] = useState<IdeaBoard | null>(null);
  const focusMode = useUiStore((state) => state.focusMode);
  const toggleFocusMode = useUiStore((state) => state.toggleFocusMode);

  // Gesto de card ativo (dedo/mouse no meio de um tap/hold/arraste): com
  // 2 dedos, o pan não age — o 1º dedo já começou um gesto no card.
  const gestureActiveRef = useRef(false);
  // Encerra o gesto em andamento (remove os listeners do window).
  const gestureEndRef = useRef<(() => void) | null>(null);
  // Alça de conexão em arraste: origem + ponta em coords de conteúdo.
  const [linkDrag, setLinkDrag] = useState<{
    fromId: EntityId;
    x: number;
    y: number;
  } | null>(null);
  // Resize ao vivo durante o arraste do grip (persiste no pointerup).
  const [resize, setResize] = useState<{
    id: EntityId;
    w: number;
    h: number;
  } | null>(null);
  // Ids que arrastam juntos (grupo persistente ou seleção múltipla).
  const dragIdsRef = useRef<EntityId[]>([]);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  // Rajada de setas: posições originais (undo) e atuais — 1 op por rajada.
  const nudgeRef = useRef<{
    starts: Map<EntityId, { x: number; y: number }>;
    positions: Map<EntityId, { x: number; y: number }>;
  } | null>(null);
  const nudgeTimerRef = useRef<number | undefined>(undefined);
  // O listener de pan lê o estado do espaço sem re-attach.
  const spacePanningRef = useRef(false);
  spacePanningRef.current = spacePanning;
  const groupInputRef = useRef<HTMLInputElement | null>(null);
  const boardInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const hasCards = cards.length > 0;

  /** Nome do grupo de cada card (badge). */
  const groupNames = useMemo(
    () => new Map(groups.map((group) => [group.id, group.name])),
    [groups],
  );

  const selectedCards = useMemo(
    () => cards.filter((card) => selection.has(card.id)),
    [cards, selection],
  );

  // Cards excluídos saem da seleção sozinhos.
  useEffect(() => {
    setSelection((prev) => {
      if (prev.size === 0) return prev;
      const alive = [...prev].filter((id) =>
        cards.some((card) => card.id === id),
      );
      return alive.length === prev.size ? prev : new Set(alive);
    });
  }, [cards]);

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

  // shortcut: âncoras medidas só quando `cards`/`zoom` mudam; troca tardia de
  // fonte pode deslocar as linhas até o próximo update — ResizeObserver se incomodar.
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const base = content.getBoundingClientRect();
    const next: Record<EntityId, CardRect> = {};
    for (const element of content.querySelectorAll<HTMLElement>(
      "[data-card-id]",
    )) {
      const rect = element.getBoundingClientRect();
      // getBoundingClientRect devolve px visuais: converte para unidades do
      // conteúdo (o SVG vive no espaço pré-escala do zoom).
      next[element.dataset.cardId!] = {
        x: (rect.left - base.left) / zoom,
        y: (rect.top - base.top) / zoom,
        width: rect.width / zoom,
        height: rect.height / zoom,
      };
    }
    setRects((prev) => (sameRects(prev, next) ? prev : next));
  }, [cards, zoom]);

  // Pan com espaço (desktop): keydown/keyup globais, fora de campos de texto.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      // Gesto de card ativo: o Espaço não abre pan no meio de um arraste.
      if (gestureActiveRef.current) return;
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

  // Pan com botão esquerdo: fundo do canvas sempre; com espaço pressionado,
  // qualquer alvo vira pan (preventDefault cancela seleção/clique). No modo
  // seleção, arraste no fundo abre um marquee em vez de dar pan.
  useEffect(() => {
    if (!hasCards) return;
    const board = boardRef.current;
    if (!board) return;
    const isBackground = (target: EventTarget | null) => {
      const element = target instanceof Element ? target : null;
      if (!element) return false;
      return !element.closest(
        "[data-card-id], button, a, input, textarea, select, [role='button']",
      );
    };
    const startMarquee = (event: MouseEvent) => {
      event.preventDefault();
      const content = contentRef.current;
      if (!content) return;
      const base = content.getBoundingClientRect();
      const start = {
        x: (event.clientX - base.left) / zoom,
        y: (event.clientY - base.top) / zoom,
      };
      let current: Marquee = {
        x0: start.x,
        y0: start.y,
        x1: start.x,
        y1: start.y,
      };
      setMarquee(current);
      const onMouseMove = (move: MouseEvent) => {
        current = {
          x0: start.x,
          y0: start.y,
          x1: (move.clientX - base.left) / zoom,
          y1: (move.clientY - base.top) / zoom,
        };
        setMarquee(current);
      };
      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        const hits = marqueeHits(rects, current);
        if (hits.length > 0) {
          setSelection((prev) => new Set([...prev, ...hits]));
        }
        setMarquee(null);
      };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    };
    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const background = isBackground(event.target);
      if (selectMode && background) {
        startMarquee(event);
        return;
      }
      const pan = spacePanningRef.current || background;
      if (!pan) return;
      if (spacePanningRef.current) event.preventDefault();
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
    // Re-anexa com cards/zoom frescos: o marquee precisa dos rects atuais.
  }, [hasCards, cards, selectMode, zoom, rects]);

  // Pan com 2 dedos (mobile); 1 dedo segue o scroll nativo. Pinch = zoom.
  useEffect(() => {
    if (!hasCards) return;
    const board = boardRef.current;
    if (!board) return;
    let last: { x: number; y: number } | null = null;
    let pinch: { dist: number; zoom: number } | null = null;
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2 && !gestureActiveRef.current) {
        last = touchMidpoint(event.touches);
        pinch = { dist: touchDistance(event.touches), zoom };
      } else {
        last = null;
        pinch = null;
      }
    };
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || !last || gestureActiveRef.current) return;
      event.preventDefault();
      const next = touchMidpoint(event.touches);
      board.scrollLeft -= next.x - last.x;
      board.scrollTop -= next.y - last.y;
      last = next;
      if (pinch && pinch.dist > 0) {
        setZoom(
          clampZoom(pinch.zoom * (touchDistance(event.touches) / pinch.dist)),
        );
      }
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) {
        last = null;
        pinch = null;
      }
    };
    board.addEventListener("touchstart", onTouchStart, { passive: false });
    board.addEventListener("touchmove", onTouchMove, { passive: false });
    board.addEventListener("touchend", onTouchEnd);
    return () => {
      board.removeEventListener("touchstart", onTouchStart);
      board.removeEventListener("touchmove", onTouchMove);
      board.removeEventListener("touchend", onTouchEnd);
    };
  }, [hasCards, zoom]);

  // Long-press no iOS/touch abre menu de contexto; gesto ativo não deve.
  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      if (gestureActiveRef.current) event.preventDefault();
    };
    window.addEventListener("contextmenu", onContextMenu);
    return () => window.removeEventListener("contextmenu", onContextMenu);
  }, []);

  // Ctrl+roda = zoom (o pinch do trackpad chega como ctrl+wheel); roda
  // comum continua sendo scroll nativo.
  useEffect(() => {
    if (!hasCards) return;
    const board = boardRef.current;
    if (!board) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      setZoom((current) =>
        clampZoom(current * Math.exp(-event.deltaY * 0.0015)),
      );
    };
    board.addEventListener("wheel", onWheel, { passive: false });
    return () => board.removeEventListener("wheel", onWheel);
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

  // Esc limpa a seleção (fora de diálogos).
  useEffect(() => {
    if (selection.size === 0) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.querySelector("[role='dialog']")) return;
      setSelection(new Set());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selection]);

  // Esc sai do modo foco — último da cadeia (conexão → seleção → foco).
  useEffect(() => {
    if (!focusMode || linkingFrom || selection.size > 0) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.querySelector("[role='dialog']")) return;
      toggleFocusMode();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusMode, linkingFrom, selection, toggleFocusMode]);

  /** Endpoint da linha durante o drag: acompanha o card em tempo real. */
  function linePoint(cardId: EntityId, center: { x: number; y: number }) {
    if (!dragDelta || !dragDelta.ids.includes(cardId)) return center;
    return {
      x: center.x + dragDelta.x / zoom,
      y: center.y + dragDelta.y / zoom,
    };
  }

  /** Persiste o lote do arraste (delta em px visuais) como 1 op de undo. */
  async function commitDrag(dxScreen: number, dyScreen: number) {
    const ids = dragIdsRef.current;
    // delta vem em px visuais: converte para unidades do conteúdo (zoom).
    const dx = dxScreen / zoom;
    const dy = dyScreen / zoom;
    if (ids.length === 0 || (dx === 0 && dy === 0)) return;
    const ops: MoveOp[] = [];
    for (const id of ids) {
      const card = cards.find((item) => item.id === id);
      if (!card) continue;
      ops.push({
        id,
        from: { x: card.x, y: card.y },
        to: { x: card.x + dx, y: card.y + dy },
      });
    }
    if (ops.length === 0) return;
    try {
      await Promise.all(
        ops.map((op) => ideaCardRepository.move(op.id, op.to.x, op.to.y)),
      );
      setUndoStack((stack) => [...stack, ops]);
      setRedoStack([]);
    } catch {
      toast.error("Falha ao mover a ideia");
    }
  }

  /** Tap: modo conexão conecta; Ctrl/Shift (ou modo seleção) alterna; senão abre. */
  function handleCardTap(card: IdeaCard, multi: boolean) {
    if (linkingFrom) {
      void toggleLink(card);
      return;
    }
    if (selectMode || multi) {
      toggleSelect(card.id);
      return;
    }
    if (card.refType) void openFicha(card);
    else setEditingId(card.id);
  }

  /** Teclado no card focado: Enter abre/conecta, setas movem, Delete exclui. */
  function handleCardKeyDown(
    event: ReactKeyboardEvent<HTMLDivElement>,
    card: IdeaCard,
  ) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      if (linkingFrom) void toggleLink(card);
      else if (card.refType) void openFicha(card);
      else setEditingId(card.id);
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      // Foco num card selecionado: a seleção inteira sai (lote).
      if (selection.has(card.id)) void deleteSelection();
      else void removeCard(card);
      return;
    }
    // Setas movem 25px (Shift = 1px); a rajada inteira = 1 undo no flush.
    const step = event.shiftKey ? 1 : 25;
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    nudgeSelection(card, delta[0]!, delta[1]!);
  }

  /** Micro-movimento por seta; 600ms ocioso agrupa a rajada em 1 undo. */
  function nudgeSelection(card: IdeaCard, dx: number, dy: number) {
    const ids = dragIdsFor(card, cards, selection);
    if (ids.length === 0) return;
    if (!nudgeRef.current) {
      const starts = new Map(
        cards
          .filter((item) => ids.includes(item.id))
          .map(
            (item) =>
              [item.id, { x: item.x, y: item.y }] as [
                EntityId,
                { x: number; y: number },
              ],
          ),
      );
      nudgeRef.current = { starts, positions: new Map(starts) };
    }
    const burst = nudgeRef.current;
    void Promise.all(
      ids.map((id) => {
        const from = burst.positions.get(id);
        if (!from) return undefined;
        const to = { x: from.x + dx, y: from.y + dy };
        burst.positions.set(id, to);
        return ideaCardRepository.move(id, to.x, to.y);
      }),
    ).catch(() => toast.error("Falha ao mover a ideia"));
    window.clearTimeout(nudgeTimerRef.current);
    nudgeTimerRef.current = window.setTimeout(() => {
      const current = nudgeRef.current;
      nudgeRef.current = null;
      if (!current) return;
      const ops: MoveOp[] = [];
      for (const [id, from] of current.starts) {
        const to = current.positions.get(id);
        if (!to || (to.x === from.x && to.y === from.y)) continue;
        ops.push({ id, from, to });
      }
      if (ops.length === 0) return;
      setUndoStack((stack) => [...stack, ops]);
      setRedoStack([]);
    }, 600);
  }

  /**
   * Gesto de ponteiro no card: tap abre/alterna, hold seleciona, arrastar
   * move. Listeners no window só existem durante o gesto (o 2º dedo não
   * rouba o primeiro).
   */
  function beginCardGesture(
    event: ReactPointerEvent<HTMLDivElement>,
    card: IdeaCard,
  ) {
    if (event.button !== 0) return;
    // Edição inline aberta: nenhum clique vira gesto (nem em outro card).
    if (editingId !== null) return;
    // Espaço pressionado: o ponteiro pertence ao pan, não ao card.
    if (spacePanningRef.current) return;
    // Botões internos têm handler próprio; não iniciam gesto no card.
    if (
      event.target instanceof Element &&
      event.target.closest("button, a, input, textarea, select")
    ) {
      return;
    }
    if (gestureEndRef.current) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const multi = event.ctrlKey || event.metaKey || event.shiftKey;
    const tracker = createGestureTracker({
      onTap: () => handleCardTap(card, multi),
      onHold: () => setSelection(new Set([card.id])),
      onDragStart: () => {
        dragIdsRef.current = dragIdsFor(card, cards, selection);
        setDragDelta({ ids: dragIdsRef.current, x: 0, y: 0 });
      },
      onDragMove: (point) => {
        setDragDelta({
          ids: dragIdsRef.current,
          x: point.x - startX,
          y: point.y - startY,
        });
      },
      onDragEnd: (point) => {
        void commitDrag(point.x - startX, point.y - startY);
      },
      onDragCancel: () => {
        dragIdsRef.current = [];
        setDragDelta(null);
      },
    });
    trackGesture(event, tracker);
  }

  /**
   * Anexa o tracker ao window: move/end/cancel fluem enquanto o gesto
   * durar (o 2º dedo não rouba o primeiro) e desmonta sozinho no fim.
   */
  function trackGesture(
    event: ReactPointerEvent<HTMLElement>,
    tracker: GestureTracker,
  ) {
    gestureActiveRef.current = true;
    const onMove = (move: PointerEvent) =>
      tracker.move({
        x: move.clientX,
        y: move.clientY,
        pointerId: move.pointerId,
      });
    const onUp = (up: PointerEvent) => {
      tracker.end({
        x: up.clientX,
        y: up.clientY,
        pointerId: up.pointerId,
      });
      gestureEndRef.current?.();
    };
    const onCancel = () => {
      tracker.cancel();
      gestureEndRef.current?.();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    // Trocar de janela no meio do arraste descarta o movimento.
    window.addEventListener("blur", onCancel);
    gestureEndRef.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("blur", onCancel);
      gestureActiveRef.current = false;
      gestureEndRef.current = null;
      dragIdsRef.current = [];
      setDragDelta(null);
    };
    tracker.start({
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    });
  }

  /** Converte um ponto da tela para coords do conteúdo (pré-zoom). */
  function toContent(point: GesturePoint) {
    const base = contentRef.current?.getBoundingClientRect();
    if (!base) return point;
    return {
      x: (point.x - base.left) / zoom,
      y: (point.y - base.top) / zoom,
    };
  }

  /** Alça da borda: arrasta uma linha até outro card para conectar. */
  function beginLinkGesture(
    event: ReactPointerEvent<HTMLElement>,
    card: IdeaCard,
  ) {
    if (event.button !== 0) return;
    if (editingId !== null) return;
    if (gestureEndRef.current) return;
    const update = (point: GesturePoint) =>
      setLinkDrag({ fromId: card.id, ...toContent(point) });
    const tracker = createGestureTracker({
      holdMs: 0,
      lockAfterHold: false,
      onDragStart: update,
      onDragMove: update,
      onDragEnd: (point) => void finishLinkDrop(card.id, point),
      onDragCancel: () => setLinkDrag(null),
    });
    trackGesture(event, tracker);
  }

  /** Soltou a linha: conecta se caiu sobre outro card; senão cancela mudo. */
  async function finishLinkDrop(fromId: EntityId, point: GesturePoint) {
    setLinkDrag(null);
    const targetId = cardAtPoint(rects, toContent(point));
    if (!targetId || targetId === fromId) return;
    try {
      await ideaCardRepository.link(fromId, targetId);
      toast.success("Conexão criada");
    } catch {
      toast.error("Falha ao criar a conexão");
    }
  }

  /** Grip do canto: redimensiona ao vivo e persiste no soltar. */
  function beginResizeGesture(
    event: ReactPointerEvent<HTMLElement>,
    card: IdeaCard,
  ) {
    if (event.button !== 0) return;
    if (editingId !== null) return;
    if (gestureEndRef.current) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const startW = card.w ?? 224;
    const startH = card.h ?? rects[card.id]?.height ?? 120;
    let latest: { w: number; h: number } | null = null;
    const update = (point: GesturePoint) => {
      latest = {
        w: Math.max(200, Math.round(startW + (point.x - startX) / zoom)),
        h: Math.max(120, Math.round(startH + (point.y - startY) / zoom)),
      };
      setResize({ id: card.id, ...latest });
    };
    const tracker = createGestureTracker({
      holdMs: 0,
      lockAfterHold: false,
      onDragStart: update,
      onDragMove: update,
      onDragEnd: () => {
        setResize(null);
        if (latest && (latest.w !== startW || latest.h !== startH)) {
          void ideaCardRepository
            .update(card.id, { w: latest.w, h: latest.h })
            .catch(() => toast.error("Falha ao redimensionar a ideia"));
        }
      },
      onDragCancel: () => setResize(null),
    });
    trackGesture(event, tracker);
  }

  async function undoMove() {
    const ops = undoStack[undoStack.length - 1];
    if (!ops) return;
    try {
      await Promise.all(
        ops.map((op) => ideaCardRepository.move(op.id, op.from.x, op.from.y)),
      );
      setUndoStack((stack) => stack.slice(0, -1));
      setRedoStack((stack) => [...stack, ops]);
    } catch {
      toast.error("Falha ao desfazer");
    }
  }

  async function redoMove() {
    const ops = redoStack[redoStack.length - 1];
    if (!ops) return;
    try {
      await Promise.all(
        ops.map((op) => ideaCardRepository.move(op.id, op.to.x, op.to.y)),
      );
      setRedoStack((stack) => stack.slice(0, -1));
      setUndoStack((stack) => [...stack, ops]);
    } catch {
      toast.error("Falha ao refazer");
    }
  }

  /** Alinhar/espaçar é um lote de movimentos: entra no histórico como um. */
  async function applyLayout(moves: LayoutMove[]) {
    if (moves.length === 0) return;
    try {
      await Promise.all(
        moves.map((move) =>
          ideaCardRepository.move(move.id, move.to.x, move.to.y),
        ),
      );
      setUndoStack((stack) => [...stack, moves]);
      setRedoStack([]);
    } catch {
      toast.error("Falha ao alinhar");
    }
  }

  // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y fora de campos e diálogos.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      const element = event.target as HTMLElement | null;
      if (
        element &&
        (element.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName))
      ) {
        return;
      }
      if (document.querySelector("[role='dialog']")) return;
      const redo = key === "y" || event.shiftKey;
      event.preventDefault();
      if (redo) void redoMove();
      else void undoMove();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undoStack, redoStack]);

  async function createCard() {
    // Novos cards entram em cascata no canto do canvas.
    const n = cards.length;
    try {
      const card = await ideaCardRepository.create({
        projectId,
        x: 16 + (n % 5) * 24,
        y: 16 + (n % 5) * 40,
      });
      setEditingId(card.id);
    } catch {
      toast.error("Falha ao criar a ideia");
    }
  }

  /** Cria um node de ficha (personagem/local) no canto do canvas. */
  async function createFichaCard(
    refType: "character" | "location",
    entity: { id: string; name: string; description?: string | null },
  ) {
    // Mesma cascata da "Nova ideia", cor fixa por tipo de ficha.
    const n = cards.length;
    try {
      await ideaCardRepository.create({
        projectId,
        refType,
        refId: entity.id,
        title: entity.name,
        content: entity.description ?? "",
        color: refType === "character" ? "purple" : "blue",
        x: 16 + (n % 5) * 24,
        y: 16 + (n % 5) * 40,
      });
      playUiSound("create");
      toast.success("Ficha adicionada ao canvas");
      setFichaDialogOpen(false);
    } catch {
      toast.error("Falha ao adicionar a ficha");
    }
  }

  /** Abre a ficha do node; a ficha pode ter sido excluída desde a criação. */
  async function openFicha(card: IdeaCard) {
    if (!card.refType || !card.refId) return;
    const found =
      card.refType === "character"
        ? await characterRepository.getById(card.refId)
        : await locationRepository.getById(card.refId);
    if (!found) {
      toast.error("Ficha não encontrada");
      return;
    }
    setFichaTarget({ type: card.refType, id: card.refId });
  }

  async function duplicateCard(card: IdeaCard) {
    try {
      await ideaCardRepository.create({
        projectId,
        title: `${card.title} (cópia)`,
        content: card.content,
        color: card.color,
        refType: card.refType,
        refId: card.refId,
        x: card.x + 24,
        y: card.y + 24,
        w: card.w,
        h: card.h,
        doc: card.doc,
      });
      toast.success("Ideia duplicada");
    } catch {
      toast.error("Falha ao duplicar a ideia");
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

  function toggleSelect(id: EntityId) {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function createGroup() {
    const name = groupName.trim();
    if (!name) {
      toast.error("Dê um nome ao grupo");
      return;
    }
    if (selectedCards.length < 2) return;
    try {
      const group = await ideaGroupRepository.create({ projectId, name });
      await Promise.all(
        selectedCards.map((card) =>
          ideaCardRepository.update(card.id, { groupId: group.id }),
        ),
      );
      playUiSound("create");
      toast.success(`Grupo "${name}" criado`);
      setGroupDialogOpen(false);
      setSelection(new Set());
    } catch {
      toast.error("Falha ao criar o grupo");
    }
  }

  async function ungroupSelection() {
    const members = selectedCards.filter((card) => card.groupId);
    if (members.length === 0) return;
    try {
      await Promise.all(
        members.map((card) =>
          ideaCardRepository.update(card.id, { groupId: null }),
        ),
      );
      const groupIds = new Set(members.map((card) => card.groupId));
      for (const groupId of groupIds) {
        // Grupo sem membros visíveis é apagado; card na lixeira com groupId
        // órfão só perde o badge.
        const stillUsed =
          groupId &&
          cards.some(
            (card) =>
              card.groupId === groupId &&
              !members.some((member) => member.id === card.id),
          );
        if (groupId && !stillUsed) {
          await ideaGroupRepository.hardDelete(groupId);
        }
      }
      toast("Grupo desfeito");
    } catch {
      toast.error("Falha ao desagrupar");
    }
  }

  async function deleteSelection() {
    const members = selectedCards;
    if (members.length === 0) return;
    try {
      await Promise.all(
        members.map((card) => ideaCardRepository.softDelete(card.id)),
      );
      playUiSound("delete");
      setSelection(new Set());
      toast(`${members.length} ideia(s) movidas para a lixeira`, {
        action: {
          label: "Desfazer",
          onClick: () => {
            void Promise.all(
              members.map((card) => ideaCardRepository.restore(card.id)),
            );
          },
        },
      });
    } catch {
      toast.error("Falha ao excluir as ideias");
    }
  }

  /** Snapshot dos cards atuais; `key` = id atual (remapeia links ao carregar). */
  function snapshotItems(): IdeaBoardItem[] {
    return cards.map((card) => ({
      key: card.id,
      title: card.title,
      content: card.content,
      color: card.color,
      x: card.x,
      y: card.y,
      links: card.links,
      refType: card.refType,
      refId: card.refId,
      w: card.w,
      h: card.h,
      doc: card.doc,
    }));
  }

  async function saveBoard() {
    const name = boardName.trim();
    if (!name) {
      toast.error("Dê um nome ao quadro");
      return;
    }
    try {
      await ideaBoardRepository.create({
        projectId,
        name,
        items: snapshotItems(),
      });
      playUiSound("save");
      toast.success(`Quadro "${name}" salvo`);
      setSaveDialogOpen(false);
      setBoardName("");
    } catch {
      toast.error("Falha ao salvar o quadro");
    }
  }

  function exportBoard() {
    if (cards.length === 0) return;
    downloadBlob(
      new Blob([JSON.stringify(buildBoardExport(snapshotItems()), null, 2)], {
        type: "application/json",
      }),
      "quadro-autor.json",
    );
    playUiSound("backup");
  }

  /** Cria cards de um snapshot remapeando `key` → novo id (links incluso). */
  async function createFromItems(items: IdeaBoardItem[]): Promise<number> {
    const idByKey = new Map<string, EntityId>();
    for (const item of items) {
      const card = await ideaCardRepository.create({
        projectId,
        title: item.title,
        content: item.content,
        color: item.color,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        refType: item.refType,
        refId: item.refId,
        doc: item.doc,
      });
      idByKey.set(item.key, card.id);
    }
    const withLinks = items.filter((item) => (item.links?.length ?? 0) > 0);
    await Promise.all(
      withLinks.map((item) => {
        const id = idByKey.get(item.key)!;
        const links = (item.links ?? [])
          .map((key) => idByKey.get(key))
          .filter((link): link is EntityId => link !== undefined);
        return links.length > 0
          ? ideaCardRepository.update(id, { links })
          : undefined;
      }),
    );
    return items.length;
  }

  async function importBoardFile(file: File) {
    try {
      const count = await createFromItems(parseBoardExport(JSON.parse(await file.text())));
      toast.success(
        `Quadro importado (${count} ideia${count === 1 ? "" : "s"})`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Falha ao importar o quadro",
      );
    }
  }

  async function loadBoard(board: IdeaBoard) {
    try {
      // Substitui: os cards atuais vão para a lixeira (recuperáveis lá).
      await Promise.all(
        cards.map((card) => ideaCardRepository.softDelete(card.id)),
      );
      const count = await createFromItems(board.items);
      setSelection(new Set());
      toast.success(
        `Quadro "${board.name}" carregado (${count} ideia${count === 1 ? "" : "s"})`,
      );
    } catch {
      toast.error("Falha ao carregar o quadro");
    }
  }

  async function deleteBoard(board: IdeaBoard) {
    try {
      await ideaBoardRepository.hardDelete(board.id);
      playUiSound("delete");
      toast(`Quadro "${board.name}" excluído`, {
        action: {
          label: "Desfazer",
          // Novo id, mesmo conteúdo — o quadro volta à lista.
          onClick: () => {
            void ideaBoardRepository.create({
              projectId,
              name: board.name,
              items: board.items,
            });
          },
        },
      });
    } catch {
      toast.error("Falha ao excluir o quadro");
    }
  }

  // Conteúdo com tamanho explícito: o SVG cobre todo o espaço scrollável
  // até o último card (largura padrão 224px + folga).
  const boardWidth = Math.max(
    ...cards.map((card) => card.x + (card.w ?? 224) + 56),
  );
  const boardHeight = Math.max(
    480,
    ...cards.map((card) => card.y + (card.h ?? 180)),
  );
  const linkingTitle = cards.find((card) => card.id === linkingFrom)?.title;

  // No modo foco o board estica: altura = viewport menos o p-4/p-6 do <main>.
  return (
    <div
      className={
        focusMode
          ? "flex h-[calc(100dvh-2rem)] flex-col gap-3 md:h-[calc(100dvh-3rem)]"
          : "grid gap-3"
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void createCard()}>
          <Plus aria-hidden />
          Nova ideia
        </Button>
        <Button variant="outline" onClick={() => setFichaDialogOpen(true)}>
          <Users aria-hidden />
          Adicionar ficha
        </Button>
        <p className="text-xs text-muted-foreground">
          Espaço + arraste (ou dois dedos) move o canvas; Ctrl + rola dá zoom
        </p>
        <span className="flex-1" />
        <Button
          variant={selectMode ? "default" : "outline"}
          size="icon"
          className="size-8"
          aria-label="Selecionar múltiplos"
          aria-pressed={selectMode}
          onClick={() => {
            setSelectMode((mode) => !mode);
            setSelection(new Set());
          }}
        >
          <MousePointerSquareDashed aria-hidden className="size-4" />
        </Button>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Diminuir zoom"
            onClick={() => setZoom((z) => clampZoom(z / 1.25))}
          >
            <ZoomOut aria-hidden className="size-4" />
          </Button>
          <span className="w-10 text-center text-xs text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Aumentar zoom"
            onClick={() => setZoom((z) => clampZoom(z * 1.25))}
          >
            <ZoomIn aria-hidden className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Desfazer movimento"
            disabled={undoStack.length === 0}
            onClick={() => void undoMove()}
          >
            <Undo2 aria-hidden className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Refazer movimento"
            disabled={redoStack.length === 0}
            onClick={() => void redoMove()}
          >
            <Redo2 aria-hidden className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Salvar quadro"
            disabled={cards.length === 0}
            onClick={() => {
              setBoardName("");
              setSaveDialogOpen(true);
            }}
          >
            <Save aria-hidden className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Exportar quadro"
            disabled={cards.length === 0}
            onClick={() => exportBoard()}
          >
            <Download aria-hidden className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Importar quadro"
            onClick={() => uploadInputRef.current?.click()}
          >
            <Upload aria-hidden className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={toggleFocusMode}
            aria-label={
              focusMode ? "Sair do modo foco" : "Ativar modo foco (Esc para sair)"
            }
          >
            {focusMode ? (
              <Minimize2 aria-hidden className="size-4" />
            ) : (
              <Maximize2 aria-hidden className="size-4" />
            )}
          </Button>
          <input
            ref={uploadInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Reset permite importar o mesmo arquivo duas vezes.
              event.target.value = "";
              if (file) void importBoardFile(file);
            }}
          />
        </div>
      </div>
      {boards.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Quadros salvos:</span>
          {boards.map((board) => (
            <span key={board.id} className="flex items-center gap-1">
              <Badge variant="outline">{board.name}</Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmBoard(board)}
              >
                Carregar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                aria-label={`Excluir quadro ${board.name}`}
                onClick={() => void deleteBoard(board)}
              >
                <Trash2 aria-hidden className="size-3.5" />
              </Button>
            </span>
          ))}
        </div>
      ) : null}
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
          {selection.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                {selection.size} selecionado{selection.size === 1 ? "" : "s"}
              </span>
              {selection.size >= 2 ? (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    aria-label="Alinhar pelo topo"
                    onClick={() => void applyLayout(alignTop(selectedCards))}
                  >
                    <AlignStartVertical aria-hidden className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    aria-label="Alinhar pela esquerda"
                    onClick={() => void applyLayout(alignLeft(selectedCards))}
                  >
                    <AlignStartHorizontal aria-hidden className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    aria-label="Espaçar verticalmente"
                    disabled={selection.size < 3}
                    onClick={() =>
                      void applyLayout(distributeVertically(selectedCards))
                    }
                  >
                    <AlignVerticalJustifyCenter aria-hidden className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    aria-label="Espaçar horizontalmente"
                    disabled={selection.size < 3}
                    onClick={() =>
                      void applyLayout(distributeHorizontally(selectedCards))
                    }
                  >
                    <AlignHorizontalJustifyCenter aria-hidden className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setGroupName("");
                      setGroupDialogOpen(true);
                    }}
                  >
                    <Group aria-hidden />
                    Agrupar
                  </Button>
                </>
              ) : null}
              {selectedCards.some((card) => card.groupId) ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void ungroupSelection()}
                >
                  <Ungroup aria-hidden />
                  Desagrupar
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={() => void deleteSelection()}
              >
                <Trash2 aria-hidden />
                Excluir ({selection.size})
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelection(new Set())}
              >
                <X aria-hidden />
                Limpar seleção
              </Button>
            </div>
          ) : null}
            <div
              ref={boardRef}
              data-slot="canvas-board"
              className={`relative min-h-[480px] cursor-grab overflow-auto rounded-lg border bg-muted/30 ${focusMode ? "flex-1" : ""}`}
            >
              <div
                ref={contentRef}
                className="relative transition-none"
                style={{
                  width: boardWidth * zoom,
                  height: boardHeight * zoom,
                }}
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
                          onClick={() => void removeLink(a, b)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") void removeLink(a, b);
                          }}
                        />
                      </g>
                    );
                  })}
                  {(() => {
                    if (!linkDrag) return null;
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
                  })()}
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
                    linking={linkingFrom === card.id}
                    linkMode={linkingFrom !== null}
                    selected={selection.has(card.id)}
                    editing={editingId === card.id}
                    onEditEnd={() => setEditingId(null)}
                    dragOffset={
                      dragDelta && dragDelta.ids.includes(card.id)
                        ? { x: dragDelta.x / zoom, y: dragDelta.y / zoom }
                        : null
                    }
                    groupName={
                      card.groupId
                        ? groupNames.get(card.groupId)
                        : undefined
                    }
                    liveSize={
                      resize?.id === card.id
                        ? { w: resize.w, h: resize.h }
                        : null
                    }
                    onLinkHandleDown={(event) => beginLinkGesture(event, card)}
                    onResizeHandleDown={(event) =>
                      beginResizeGesture(event, card)
                    }
                    onGestureDown={(event) => beginCardGesture(event, card)}
                    onCardKeyDown={(event) => handleCardKeyDown(event, card)}
                    onLink={() => void toggleLink(card)}
                    onEdit={() => {
                      if (card.refType) void openFicha(card);
                      else setEditingId(card.id);
                    }}
                    onSend={() => setSendCard(card)}
                    onDuplicate={() => void duplicateCard(card)}
                  />
                ))}
                </div>
              </div>
            </div>
        </>
      )}

      <SendCardDialog
        card={sendCard}
        chapters={chapters}
        open={sendCard !== null}
        onOpenChange={(open) => {
          if (!open) setSendCard(null);
        }}
      />
      <Dialog
        open={groupDialogOpen}
        onOpenChange={(open) => {
          setGroupDialogOpen(open);
          if (!open) setGroupName("");
        }}
      >
        <DialogContent
          className="sm:max-w-sm"
          onKeyDown={(event) => handleDialogEnter(event, () => void createGroup())}
        >
          <DialogHeader>
            <DialogTitle>Agrupar {selection.size} ideias</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="group-name">Nome do grupo</Label>
            <Input
              id="group-name"
              ref={groupInputRef}
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Ex.: Arco principal"
            />
            <p className="text-xs text-muted-foreground">
              Arrastar qualquer card do grupo move todos juntos.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void createGroup()}>Criar grupo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={saveDialogOpen}
        onOpenChange={(open) => {
          setSaveDialogOpen(open);
          if (!open) setBoardName("");
        }}
      >
        <DialogContent
          className="sm:max-w-sm"
          onKeyDown={(event) => handleDialogEnter(event, () => void saveBoard())}
        >
          <DialogHeader>
            <DialogTitle>Salvar quadro</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="board-name">Nome do quadro</Label>
            <Input
              id="board-name"
              ref={boardInputRef}
              value={boardName}
              onChange={(event) => setBoardName(event.target.value)}
              placeholder="Ex.: Ato 1"
            />
            <p className="text-xs text-muted-foreground">
              Guarda um snapshot das {cards.length} ideia(s) atual(is).
              Carregar um quadro substitui o canvas — as ideias atuais vão para
              a lixeira.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void saveBoard()}>Salvar quadro</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={confirmBoard !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmBoard(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Carregar “{confirmBoard?.name}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Substitui as {cards.length} ideia(s) do canvas — elas vão para a
              lixeira e podem ser recuperadas lá.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const board = confirmBoard;
                setConfirmBoard(null);
                if (board) void loadBoard(board);
              }}
            >
              Carregar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={fichaDialogOpen} onOpenChange={setFichaDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar ficha ao canvas</DialogTitle>
          </DialogHeader>
          {characters.length === 0 && locations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Crie personagens ou locais primeiro nas seções deles.
            </p>
          ) : null}
          {characters.length > 0 ? (
            <div className="grid gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                Personagens
              </p>
              <div className="grid gap-2">
                {characters.map((character) => (
                  <Button
                    key={character.id}
                    variant="outline"
                    onClick={() =>
                      void createFichaCard("character", character)
                    }
                  >
                    <User aria-hidden />
                    {character.name}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
          {locations.length > 0 ? (
            <div className="grid gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                Locais
              </p>
              <div className="grid gap-2">
                {locations.map((location) => (
                  <Button
                    key={location.id}
                    variant="outline"
                    onClick={() => void createFichaCard("location", location)}
                  >
                    <MapPin aria-hidden />
                    {location.name}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <MentionSheet
        target={fichaTarget}
        backToTextSeconds={0}
        backToTextEnabled={false}
        onBackToText={() => undefined}
        onEdit={(target) =>
          router.push(
            target.type === "character"
              ? `/characters?character=${target.id}`
              : `/world?location=${target.id}`,
          )
        }
        onOpenChange={(open) => {
          if (!open) setFichaTarget(null);
        }}
      />
    </div>
  );
}

function sameRects(
  a: Record<EntityId, CardRect>,
  b: Record<EntityId, CardRect>,
): boolean {
  const keys = Object.keys(b);
  if (Object.keys(a).length !== keys.length) return false;
  return keys.every(
    (key) =>
      a[key]?.x === b[key]?.x &&
      a[key]?.y === b[key]?.y &&
      a[key]?.width === b[key]?.width &&
      a[key]?.height === b[key]?.height,
  );
}

function clampZoom(value: number): number {
  return Math.min(2, Math.max(0.5, value));
}

function touchDistance(touches: TouchList): number {
  const dx = touches[0]!.clientX - touches[1]!.clientX;
  const dy = touches[0]!.clientY - touches[1]!.clientY;
  return Math.hypot(dx, dy);
}

function touchMidpoint(touches: TouchList): { x: number; y: number } {
  return {
    x: (touches[0]!.clientX + touches[1]!.clientX) / 2,
    y: (touches[0]!.clientY + touches[1]!.clientY) / 2,
  };
}

function rectCenter(rect: CardRect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** Ids dos cards cujo retângulo cruza o marquee (coords do conteúdo). */
function marqueeHits(
  rects: Record<EntityId, CardRect>,
  marquee: Marquee,
): EntityId[] {
  const x0 = Math.min(marquee.x0, marquee.x1);
  const x1 = Math.max(marquee.x0, marquee.x1);
  const y0 = Math.min(marquee.y0, marquee.y1);
  const y1 = Math.max(marquee.y0, marquee.y1);
  return Object.entries(rects)
    .filter(
      ([, rect]) =>
        rect.x < x1 && rect.x + rect.width > x0 && rect.y < y1 && rect.y + rect.height > y0,
    )
    .map(([id]) => id as EntityId);
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
  const submitRef = useRef<HTMLButtonElement | null>(null);

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
        onOpenAutoFocus={(event) => {
          // Foco no botão de criar: Enter nativo nele submete.
          event.preventDefault();
          submitRef.current?.focus();
        }}
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
            ref={submitRef}
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
