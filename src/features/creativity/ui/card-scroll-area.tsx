"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

interface CardScrollAreaProps {
  className?: string;
  children: ReactNode;
  /** pointerdown interno não deve iniciar gestos do card. */
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

/**
 * Área de rolagem dos nodes: a barra nativa fica oculta e um thumb discreto
 * aparece (fade) enquanto rola, sumindo ~800ms após a última rolagem.
 * Posição/tamanho do thumb são atualizados via DOM direto (zero re-render).
 */
export function CardScrollArea({
  className = "",
  children,
  onPointerDown,
}: CardScrollAreaProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const hideTimerRef = useRef<number | undefined>(undefined);

  const syncThumb = useCallback(() => {
    const viewport = viewportRef.current;
    const thumb = thumbRef.current;
    if (!viewport || !thumb) return;
    const overflow = viewport.scrollHeight - viewport.clientHeight;
    if (overflow <= 1) {
      thumb.style.opacity = "0";
      thumb.style.height = "0px";
      return;
    }
    const height = Math.max(
      24,
      (viewport.clientHeight / viewport.scrollHeight) * viewport.clientHeight,
    );
    thumb.style.height = `${height}px`;
    thumb.style.top = `${(viewport.scrollTop / overflow) * (viewport.clientHeight - height)}px`;
  }, []);

  const handleScroll = useCallback(() => {
    const thumb = thumbRef.current;
    if (!thumb) return;
    syncThumb();
    thumb.style.opacity = "1";
    window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      if (thumbRef.current) thumbRef.current.style.opacity = "0";
    }, 800);
  }, [syncThumb]);

  // Thumb acompanha mudanças de tamanho (resize do card, edição do texto).
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => syncThumb());
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [syncThumb]);

  useEffect(() => () => window.clearTimeout(hideTimerRef.current), []);

  return (
    <div
      className={`relative min-h-0 ${className}`}
      onPointerDown={onPointerDown}
    >
      <div
        ref={viewportRef}
        onScroll={handleScroll}
        className="no-scrollbar h-full overflow-y-auto"
      >
        {children}
      </div>
      <div
        ref={thumbRef}
        aria-hidden
        className="pointer-events-none absolute top-0 right-0.5 w-1 rounded-full bg-muted-foreground/40 opacity-0 transition-opacity duration-300"
      />
    </div>
  );
}
