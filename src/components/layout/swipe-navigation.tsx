"use client";

import { usePathname } from "next/navigation";
import { useCallback } from "react";

import {
  globalSwipeHref,
  isGlobalSwipePath,
  type SwipeDirection,
} from "@/features/read/domain/swipe-navigation";
import { useRouter } from "@/infra/navigation/use-app-router";
import { useHorizontalSwipe } from "@/shared/lib/use-horizontal-swipe";
import { useUiStore } from "@/shared/store/ui-store";

/**
 * Deslize da esquerda para a direita nas páginas secundárias: puxa a página do
 * projeto aberto. Em Projetos, Leitura, Editor e Canvas o gesto não existe
 * aqui (Leitura navega capítulos por conta própria). Só celular.
 */
export function SwipeNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const selectedProjectId = useUiStore((state) => state.selectedProjectId);
  const enabled = isGlobalSwipePath(pathname);

  const navigate = useCallback(
    (direction: SwipeDirection) => {
      const href = globalSwipeHref(direction, selectedProjectId);
      if (href) router.push(href);
    },
    [router, selectedProjectId],
  );

  const onSwipeLeft = useCallback(() => navigate("left"), [navigate]);
  const onSwipeRight = useCallback(() => navigate("right"), [navigate]);

  useHorizontalSwipe({ onSwipeLeft, onSwipeRight }, enabled);

  return null;
}