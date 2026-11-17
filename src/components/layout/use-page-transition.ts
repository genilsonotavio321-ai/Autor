"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { navGroups } from "@/components/layout/nav-items";
import { useUiStore } from "@/shared/store/ui-store";

/**
 * Transição entre páginas com a View Transitions API: o navegador fotografa a
 * página atual, o app troca de rota e o `<main>` desliza para o lado da
 * navegação (da direita ao avançar, da esquerda ao voltar).
 *
 * Dois pontos de entrada, nenhum deles reimplementando a navegação:
 * - links internos: um listener de clique em fase de captura abre a transição
 *   antes de o `<Link>` do Next chamar o `router.push`;
 * - navegação programática: `withPageTransition(destino)` antes do
 *   `router.push`/`replace` (o `useRouter` de `@/infra/navigation` já faz isso).
 *
 * O liga/desliga é o de Configurações ("Desativar animações"), igual ao das
 * outras animações do app.
 */

/** Ordem das seções na navegação: define para que lado o conteúdo desliza. */
const SECTION_ORDER = navGroups.flatMap((group) =>
  group.items.map((item) => item.href),
);

/** O editor pertence à área de Projetos para efeito de direção. */
const SECTION_ALIASES: Record<string, string> = { "/write": "/projects" };

function sectionIndex(pathname: string): number | null {
  const alias = Object.keys(SECTION_ALIASES).find(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const target = (alias ? SECTION_ALIASES[alias] : undefined) ?? pathname;

  let index: number | null = null;
  let longest = -1;
  SECTION_ORDER.forEach((href, position) => {
    const matches =
      href === "/"
        ? target === "/"
        : target === href || target.startsWith(`${href}/`);
    if (matches && href.length > longest) {
      longest = href.length;
      index = position;
    }
  });
  return index;
}

function directionBetween(from: string, to: string): "forward" | "back" {
  const fromIndex = sectionIndex(from);
  const toIndex = sectionIndex(to);
  return fromIndex !== null && toIndex !== null && toIndex < fromIndex
    ? "back"
    : "forward";
}

interface ViewTransitionLike {
  finished: Promise<void>;
  /** Aborta a animação (a troca de página já aconteceu). */
  skipTransition?: () => void;
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (
    update: () => Promise<void> | void,
  ) => ViewTransitionLike;
};

/** Se a rota não montar nesse prazo, a transição se resolve sozinha. */
const SETTLE_TIMEOUT_MS = 400;

function supportsViewTransitions(): boolean {
  return (
    typeof (document as ViewTransitionDocument).startViewTransition ===
    "function"
  );
}

function isPlainLeftClick(event: MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

/**
 * Início da transição exposto para a navegação programática. O shell registra
 * essa função enquanto as animações estão ligadas; sem registro, o `useRouter`
 * de `@/infra/navigation` só navega normalmente.
 */
let starter: ((to: string) => void) | null = null;

/** Abre a transição para `to`. Deve ser chamado antes de trocar a rota. */
export function withPageTransition(to: string) {
  starter?.(to);
}

/**
 * Liga a transição de páginas uma única vez no shell. Não renderiza nada:
 * o resultado visual vem do CSS (`#main-content` recebe `view-transition-name`).
 */
export function usePageTransition() {
  const pathname = usePathname();
  const animationsEnabled = useUiStore((state) => state.animationsEnabled);
  const release = useRef<(() => void) | null>(null);
  const fallback = useRef<number | null>(null);
  const running = useRef(false);

  /** Fotografa a página atual e deixa a animação pendente até a rota montar. */
  const start = useCallback((from: string, to: string) => {
    if (running.current || !supportsViewTransitions()) return;
    const doc = document as ViewTransitionDocument;
    running.current = true;
    document.documentElement.dataset.navDirection = directionBetween(from, to);

    const transition = doc.startViewTransition?.(() => {
      return new Promise<void>((settle) => {
        release.current = settle;
        fallback.current = window.setTimeout(() => {
          release.current = null;
          fallback.current = null;
          // Navegação que não aconteceu (clique cancelado): nada a animar.
          transition?.skipTransition?.();
          settle();
        }, SETTLE_TIMEOUT_MS);
      });
    });

    // `finished` rejeita quando a transição é interrompida por outra.
    void transition?.finished
      .catch(() => undefined)
      .finally(() => {
        running.current = false;
        document.documentElement.removeAttribute("data-nav-direction");
      });
  }, []);

  // A rota nova montou: libera o navegador para animar a troca.
  useEffect(() => {
    if (fallback.current !== null) {
      window.clearTimeout(fallback.current);
      fallback.current = null;
    }
    const settle = release.current;
    release.current = null;
    settle?.();
  }, [pathname]);

  // Navegação programática (`router.push`/`replace`).
  useEffect(() => {
    if (!animationsEnabled || !supportsViewTransitions()) return;
    starter = (to) => start(window.location.pathname, new URL(to, location.href).pathname);
    return () => {
      starter = null;
    };
  }, [animationsEnabled, start]);

  useEffect(() => {
    if (!animationsEnabled || !supportsViewTransitions()) return;

    function handleClick(event: MouseEvent) {
      if (!isPlainLeftClick(event) || event.defaultPrevented) return;
      const anchor =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Mesma rota (só hash/query): nada a animar.
      if (url.pathname === window.location.pathname) return;

      start(window.location.pathname, url.pathname);
    }

    // Captura: o snapshot da página atual precisa ser tirado antes do
    // `<Link>` disparar o `router.push` no seu próprio onClick.
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [animationsEnabled, start]);
}
