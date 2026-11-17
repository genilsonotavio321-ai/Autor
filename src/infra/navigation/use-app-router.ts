"use client";

import { useRouter as useNextRouter } from "next/navigation";
import { useMemo } from "react";

import { withPageTransition } from "@/components/layout/use-page-transition";

/**
 * `useRouter` do Next com a transição de páginas embutida: todo
 * `push`/`replace` programático anima igual à navegação por link. Quem não
 * precisa da animação (ex.: retomada automática no primeiro carregamento)
 * continua importando de `next/navigation`.
 */
export function useRouter() {
  const router = useNextRouter();

  return useMemo(() => {
    return {
      ...router,
      push: (href: string, options?: Parameters<typeof router.push>[1]) => {
        withPageTransition(href);
        router.push(href, options);
      },
      replace: (href: string, options?: Parameters<typeof router.replace>[1]) => {
        withPageTransition(href);
        router.replace(href, options);
      },
    };
  }, [router]);
}
