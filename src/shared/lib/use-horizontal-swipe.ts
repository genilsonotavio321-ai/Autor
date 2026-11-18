"use client";

import { useEffect, useRef } from "react";

import {
  isEdgeTouch,
  resolveSwipeGesture,
  type SwipeDirection,
} from "@/features/read/domain/swipe-navigation";

export interface HorizontalSwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

/** Depois de um gesto reconhecido o app ignora gestos por este tempo. */
export const SWIPE_COOLDOWN_MS = 400;
/** Janela em que o clique sintetico do fim do gesto e cancelado. */
const CLICK_SWALLOW_MS = 500;

function isCoarsePointer(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: none) and (pointer: coarse)").matches
  );
}

/** Ancestral que rola na horizontal (canvas, kanban, timeline) fica intocado. */
function hasHorizontalScrollAncestor(target: EventTarget | null): boolean {
  let node = target instanceof Element ? target : null;
  while (node && node !== document.body) {
    if (node.scrollWidth > node.clientWidth + 8) {
      const { overflowX } = window.getComputedStyle(node);
      if (overflowX === "auto" || overflowX === "scroll") return true;
    }
    node = node.parentElement;
  }
  return false;
}

function isIgnoredTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('[contenteditable="true"], [data-swipe-ignore]')) return true;
  if (
    target.closest(
      '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [role="slider"]',
    )
  ) {
    return true;
  }
  return hasHorizontalScrollAncestor(target);
}

/**
 * Dono do gesto. Os handlers ficam atras de uma funcao (e nao guardados no
 * registro) para que um render no meio do toque nao apague o gesto em curso.
 */
interface SwipeOwner {
  handlers: () => HorizontalSwipeHandlers;
}

/** Pilha de consumidores: so o ultimo habilitado recebe o gesto. */
const owners: SwipeOwner[] = [];
let listening = false;
let lastSwipeAt = 0;
let swallowClickUntil = 0;

let tracking = false;
let multiTouch = false;
let startX = 0;
let startY = 0;
let startTime = 0;

function swallowNextClick() {
  swallowClickUntil = Date.now() + CLICK_SWALLOW_MS;
}

function handleClick(event: MouseEvent) {
  if (Date.now() > swallowClickUntil) return;
  swallowClickUntil = 0;
  // Um deslize nunca deve terminar clicando no que estava sob o dedo.
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function handleTouchStart(event: TouchEvent) {
  if (!isCoarsePointer()) {
    tracking = false;
    return;
  }
  if (event.touches.length !== 1) {
    tracking = false;
    multiTouch = true;
    return;
  }
  multiTouch = false;

  const selection = window.getSelection();
  if (isIgnoredTarget(event.target) || (selection && !selection.isCollapsed)) {
    tracking = false;
    return;
  }

  const touch = event.touches[0];
  if (!touch) return;
  // Borda e do sistema: arrastar dali abre o "voltar" do navegador.
  if (isEdgeTouch(touch.clientX, window.innerWidth)) {
    tracking = false;
    return;
  }

  startX = touch.clientX;
  startY = touch.clientY;
  startTime = Date.now();
  tracking = true;
}

function handleTouchCancel() {
  tracking = false;
  multiTouch = false;
}

function handleTouchEnd(event: TouchEvent) {
  if (!tracking || multiTouch) return;
  tracking = false;
  // Um card sendo arrastado (toque longo) nao e navegacao.
  if (document.querySelector("[data-dragging]")) return;
  if (Date.now() - lastSwipeAt < SWIPE_COOLDOWN_MS) return;

  const touch = event.changedTouches[0];
  if (!touch) return;

  const direction: SwipeDirection | null = resolveSwipeGesture({
    dx: touch.clientX - startX,
    dy: touch.clientY - startY,
    durationMs: Date.now() - startTime,
  });
  if (!direction) return;

  const owner = owners[owners.length - 1];
  if (!owner) return;

  lastSwipeAt = Date.now();
  swallowNextClick();

  const handlers = owner.handlers();
  if (direction === "right") handlers.onSwipeRight?.();
  else handlers.onSwipeLeft?.();
}

function syncListeners() {
  if (typeof document === "undefined") return;
  if (owners.length > 0 === listening) return;
  listening = owners.length > 0;
  if (listening) {
    document.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    document.addEventListener("touchcancel", handleTouchCancel, {
      passive: true,
    });
    document.addEventListener("click", handleClick, true);
    return;
  }
  document.removeEventListener("touchstart", handleTouchStart);
  document.removeEventListener("touchend", handleTouchEnd);
  document.removeEventListener("touchcancel", handleTouchCancel);
  document.removeEventListener("click", handleClick, true);
  tracking = false;
  multiTouch = false;
}

function registerSwipeOwner(owner: SwipeOwner): () => void {
  owners.push(owner);
  syncListeners();
  return () => {
    const index = owners.indexOf(owner);
    if (index >= 0) owners.splice(index, 1);
    syncListeners();
  };
}

/**
 * Deslize horizontal para navegacao, exclusivo de celular. Um unico conjunto
 * de listeners atende o app inteiro e so o ultimo consumidor habilitado
 * responde — dois componentes na mesma rota nao navegam duas vezes.
 *
 * Nao chama `preventDefault` no toque: a rolagem vertical continua do
 * navegador e o gesto so e lido no fim.
 */
export function useHorizontalSwipe(
  { onSwipeLeft, onSwipeRight }: HorizontalSwipeHandlers,
  enabled = true,
) {
  const handlers = useRef<HorizontalSwipeHandlers>({});
  handlers.current = { onSwipeLeft, onSwipeRight };

  useEffect(() => {
    if (!enabled) return;
    return registerSwipeOwner({ handlers: () => handlers.current });
  }, [enabled]);
}
