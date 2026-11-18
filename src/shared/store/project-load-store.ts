import { create } from "zustand";

interface ProjectLoadState {
  /** Projeto cujo conteúdo está sendo carregado; `null` = nada pendente. */
  pendingProjectId: string | null;
  /**
   * Páginas montadas que carregam dados do projeto e avisam prontidão
   * (`useProjectReady`). Sem nenhuma, não há o que esperar.
   */
  waiting: number;
  /** Registra a troca/abertura de projeto (ignora o mesmo projeto). */
  start: (projectId: string) => void;
  /** Encerra o carregamento; com id, só se for o projeto pendente. */
  finish: (projectId?: string | null) => void;
  /** Encerra incondicionalmente (limite de segurança do overlay). */
  reset: () => void;
  /** Registra uma página que sinaliza prontidão (ao montar). */
  watch: () => void;
  /** Remove o registro da página (ao desmontar). */
  unwatch: () => void;
}

/**
 * Estado transiente (não persistido) que liga a tela de carregamento quando o
 * projeto selecionado muda. As páginas avisam quando seus dados resolveram
 * (`useProjectReady`); o overlay só espera quando existe alguma página dessas
 * montada — rotas sem dados de projeto (Configurações, Painel, Lixeira,
 * Projetos) não prendem a tela.
 */
export const useProjectLoadStore = create<ProjectLoadState>((set, get) => ({
  pendingProjectId: null,
  waiting: 0,
  start: (projectId) => {
    if (get().pendingProjectId === projectId) return;
    set({ pendingProjectId: projectId });
  },
  finish: (projectId) => {
    const pending = get().pendingProjectId;
    if (!pending) return;
    if (projectId && projectId !== pending) return;
    set({ pendingProjectId: null });
  },
  reset: () => set({ pendingProjectId: null }),
  watch: () => set((state) => ({ waiting: state.waiting + 1 })),
  unwatch: () =>
    set((state) => ({ waiting: Math.max(0, state.waiting - 1) })),
}));
