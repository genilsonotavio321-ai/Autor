"use client";

import { useEffect } from "react";

export interface HorizontalSwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

/** Distância mínima do gesto, em px. */
const MIN_DISTANCE = 60;
/** Gesto mais longo que isso é rolagem/leitura, não navegação. */
const MAX_DURATION_MS = 800;
/** O deslocamento horizontal precisa dominar o vertical. */
const DIRECTION_RATIO = 1.8;

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
 * Deslize horizontal para navegação, exclusivo de celular. Não chama
 * `preventDefault`: a rolagem vertical continua sendo do navegador e o gesto só
 * é lido no fim do toque.
 */
export function useHorizontalSwipe(
  { onSwipeLeft, onSwipeRight }: HorizontalSwipeHandlers,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled || !isCoarsePointer()) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let tracking = false;
    let multiTouch = false;

    function handleStart(event: TouchEvent) {
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
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = Date.now();
      tracking = true;
    }

    function handleCancel() {
      tracking = false;
      multiTouch = false;
    }

    function handleEnd(event: TouchEvent) {
      if (!tracking || multiTouch) return;
      tracking = false;
      // Um card sendo arrastado (toque longo) não é navegação.
      if (document.querySelector("[data-dragging]")) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      if (Date.now() - startTime > MAX_DURATION_MS) return;

      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Math.abs(dx) < MIN_DISTANCE) return;
      if (Math.abs(dx) <= Math.abs(dy) * DIRECTION_RATIO) return;

      if (dx > 0) onSwipeRight?.();
      else onSwipeLeft?.();
    }

    document.addEventListener("touchstart", handleStart, { passive: true });
    document.addEventListener("touchend", handleEnd, { passive: true });
    document.addEventListener("touchcancel", handleCancel, { passive: true });
    return () => {
      document.removeEventListener("touchstart", handleStart);
      document.removeEventListener("touchend", handleEnd);
      document.removeEventListener("touchcancel", handleCancel);
    };
  }, [enabled, onSwipeLeft, onSwipeRight]);
}