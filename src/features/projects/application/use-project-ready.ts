"use client";

import { useEffect } from "react";

import { useProjectLoadStore } from "@/shared/store/project-load-store";
import type { EntityId } from "@/shared/types/database";

/**
 * Avisa que a página terminou de carregar os dados do projeto aberto. Fecha a
 * tela de carregamento quando o projeto pendente é o que a página exibe —
 * `ready` deve vir dos `undefined` das live queries (dados resolvidos).
 */
export function useProjectReady(
  ready: boolean,
  projectId: EntityId | null | undefined,
): void {
  const pendingProjectId = useProjectLoadStore(
    (state) => state.pendingProjectId,
  );

  // Só páginas com dados do projeto esperam pelo carregamento. O overlay usa
  // essa contagem para não prender a tela em rotas sem projeto.
  useEffect(() => {
    const store = useProjectLoadStore.getState();
    store.watch();
    return () => store.unwatch();
  }, []);

  useEffect(() => {
    if (!ready || !pendingProjectId) return;
    // Projeto removido/inexistente: não há mais o que esperar.
    if (projectId && projectId !== pendingProjectId) return;
    useProjectLoadStore.getState().finish(pendingProjectId);
  }, [pendingProjectId, projectId, ready]);
}
