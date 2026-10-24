"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
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
import {
  AlignHorizontalJustifyCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalJustifyCenter,
  Copy,
  Download,
  Group,
  Link2,
  Maximize2,
  Minimize2,
  MousePointerSquareDashed,
  Pencil,
  Plus,
  Redo2,
  Save,
  Send,
  Trash2,
  Undo2,
  Ungroup,
  Upload,
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
import { Textarea } from "@/components/ui/textarea";
import { handleDialogEnter } from "@/shared/lib/keyboard";
import { playUiSound } from "@/shared/lib/sound";
import { useUiStore } from "@/shared/store/ui-store";
import type {
  Chapter,
  EntityId,
  IdeaBoard,
  IdeaBoardItem,
  IdeaCard,
  IdeaGroup,
} from "@/shared/types/database";

import { sendSceneToOutline } from "../application/send-to-outline";
import { buildBoardExport, parseBoardExport } from "../domain/board-io";
import {
  alignLeft,
  alignTop,
  distributeHorizontally,
  distributeVertically,
  type LayoutMove,
} from "../domain/canvas-layout";
import { downloadBlob } from "@/features/export/infra/download";
import { ideaBoardRepository } from "../infra/dexie-idea-board-repository";
import { ideaCardRepository } from "../infra/dexie-idea-card-repository";
import { ideaGroupRepository } from "../infra/dexie-idea-group-repository";

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
const NO_GROUPS: IdeaGroup[] = [];
const NO_BOARDS: IdeaBoard[] = [];

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
  const [editCard, setEditCard] = useState<IdeaCard | null>(null);
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

  const sensors = useSensors(
    // Segurar ~250px-move arrasta; clique rápido abre o card (fase 4).
    useSensor(PointerSensor, {
      activationConstraint: { delay: 250, tolerance: 6 },
    }),
    // Padrão do dnd-kit: Espaço INICIA drag de teclado no card focado —
    // conflitava com o pan (Espaço "movia" cards sozinho). Enter inicia/encerra.
    useSensor(KeyboardSensor, {
      keyboardCodes: { start: ["Enter"], cancel: ["Escape"], end: ["Enter"] },
    }),
  );

  // Drag do dnd-kit ativo: com 2 dedos, o pan não age (o 1º dedo no grip
  // já começou um arraste de card).
  const activeDragRef = useRef<string | number | null>(null);
  // Ids que arrastam juntos (grupo persistente ou seleção múltipla).
  const dragIdsRef = useRef<EntityId[]>([]);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  // Soltar um arraste dispara click no card: suprimimos o próximo clique.
  const suppressClick = useRef(false);
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
      // Drag de teclado ativo: o espaço pertence ao dnd-kit, não ao pan.
      if (activeDragRef.current) return;
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
      if (event.touches.length === 2 && !activeDragRef.current) {
        last = touchMidpoint(event.touches);
        pinch = { dist: touchDistance(event.touches), zoom };
      } else {
        last = null;
        pinch = null;
      }
    };
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || !last || activeDragRef.current) return;
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

  function suppressNextClick() {
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
  }

  /** Endpoint da linha durante o drag: acompanha o card em tempo real. */
  function linePoint(cardId: EntityId, center: { x: number; y: number }) {
    if (!dragDelta || !dragDelta.ids.includes(cardId)) return center;
    return {
      x: center.x + dragDelta.x / zoom,
      y: center.y + dragDelta.y / zoom,
    };
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, delta } = event;
    if (!delta || (delta.x === 0 && delta.y === 0)) return;
    const ids =
      dragIdsRef.current.length > 0
        ? dragIdsRef.current
        : [active.id as EntityId];
    // delta vem em px visuais: converte para unidades do conteúdo (zoom).
    const dx = delta.x / zoom;
    const dy = delta.y / zoom;
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
      setEditCard(card);
    } catch {
      toast.error("Falha ao criar a ideia");
    }
  }

  async function duplicateCard(card: IdeaCard) {
    try {
      await ideaCardRepository.create({
        projectId,
        title: `${card.title} (cópia)`,
        content: card.content,
        color: card.color,
        x: card.x + 24,
        y: card.y + 24,
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
  // até o último card (largura do card = 224px + folga).
  const boardWidth = Math.max(...cards.map((card) => card.x + 280));
  const boardHeight = Math.max(480, ...cards.map((card) => card.y + 180));
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
          <DndContext
            sensors={spacePanning ? [] : sensors}
            collisionDetection={() => []}
            onDragStart={(event) => {
              const card = cards.find((item) => item.id === event.active.id);
              activeDragRef.current = event.active.id;
              suppressClick.current = true;
              // Membros do grupo persistente arrastam juntos; fora dele, a
              // seleção múltipla inteira; sozinho, só o card ativo.
              dragIdsRef.current = card
                ? card.groupId
                  ? cards
                      .filter((item) => item.groupId === card.groupId)
                      .map((item) => item.id)
                  : selection.has(card.id)
                    ? [...selection]
                    : [card.id]
                : [event.active.id as EntityId];
              setDragDelta({ ids: dragIdsRef.current, x: 0, y: 0 });
            }}
            onDragMove={(event) => {
              setDragDelta({
                ids: dragIdsRef.current,
                x: event.delta.x,
                y: event.delta.y,
              });
            }}
            onDragEnd={(event) => {
              activeDragRef.current = null;
              dragIdsRef.current = [];
              setDragDelta(null);
              suppressNextClick();
              void handleDragEnd(event);
            }}
            onDragCancel={() => {
              activeDragRef.current = null;
              dragIdsRef.current = [];
              setDragDelta(null);
              suppressNextClick();
            }}
          >
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
                    suppressClick={suppressClick}
                    selected={selection.has(card.id)}
                    selectMode={selectMode}
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
                    onToggleSelect={() => toggleSelect(card.id)}
                    onLink={() => void toggleLink(card)}
                    onEdit={() => setEditCard(card)}
                    onSend={() => setSendCard(card)}
                    onDuplicate={() => void duplicateCard(card)}
                  />
                ))}
                </div>
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
  /** Suprime o clique que o navegador dispara ao soltar um arraste. */
  suppressClick: RefObject<boolean>;
  selected: boolean;
  selectMode: boolean;
  /** Deslocamento visual do drag (px de conteúdo) para todos os ids do lote. */
  dragOffset: { x: number; y: number } | null;
  /** Nome do grupo persistente do card, se houver (badge). */
  groupName?: string;
  onToggleSelect: () => void;
  onLink: () => void;
  onEdit: () => void;
  onSend: () => void;
  onDuplicate: () => void;
}

function IdeaCardView({
  card,
  linking,
  linkMode,
  suppressClick,
  selected,
  selectMode,
  dragOffset,
  groupName,
  onToggleSelect,
  onLink,
  onEdit,
  onSend,
  onDuplicate,
}: IdeaCardViewProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
  });
  const style = {
    left: card.x,
    top: card.y,
    // O offset é compartilhado por todos os ids que arrastam juntos — o
    // transform do dnd só cobria o card ativo.
    transform: dragOffset
      ? `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)`
      : undefined,
    ...(isDragging ? { zIndex: 10 } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      data-card-id={card.id}
      data-dragging={isDragging || undefined}
      {...attributes}
      {...listeners}
      aria-label={`Ideia ${card.title}`}
      style={style}
      onClick={(event) => {
        if (suppressClick.current) return;
        // Clique em botão/link interno tem handler próprio; não abre o card.
        if (
          event.target instanceof Element &&
          event.target.closest("button, a, input, textarea, select")
        ) {
          return;
        }
        // Modo seleção (ou Ctrl/Shift+clique) alterna; senão abre o card.
        if (selectMode || event.ctrlKey || event.metaKey || event.shiftKey) {
          onToggleSelect();
          return;
        }
        onEdit();
      }}
      // transition-none: o MotionStyle global injeta transition-duration em *;
      // sem isso o transform do drag transiciona a cada pointermove (lag).
      className={`absolute w-56 cursor-grab touch-none rounded-lg border-2 bg-card p-3 shadow-sm transition-none select-none ${CARD_COLORS[card.color ?? "yellow"] ?? ""} ${selected ? "ring-2 ring-primary" : ""} ${isDragging ? "opacity-70" : ""}`}
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

interface EditCardDialogProps {
  card: IdeaCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function EditCardDialog({ card, open, onOpenChange }: EditCardDialogProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState("yellow");
  const titleRef = useRef<HTMLInputElement | null>(null);

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
        onOpenAutoFocus={(event) => {
          // Foco no campo (não no card por trás) para Enter salvar.
          event.preventDefault();
          titleRef.current?.focus();
        }}
        onKeyDown={(event) => handleDialogEnter(event, () => void save())}
      >
        <DialogHeader>
          <DialogTitle>Editar ideia</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="idea-title">Título</Label>
            <Input
              ref={titleRef}
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
