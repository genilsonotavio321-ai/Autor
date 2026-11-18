"use client";

import {
  Bookmark,
  BookOpen,
  Eye,
  History,
  ImagePlus,
  ListTree,
  PanelRightClose,
  Redo2,
  Share2,
  SpellCheck2,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CHAPTER_STATUS_DOT,
  CHAPTER_STATUS_LABELS,
} from "@/features/projects/domain/repository";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/shared/store/ui-store";
import type { ChapterStatus } from "@/shared/types/database";

import { SaveStatusIndicator, type SaveStatus } from "./save-status-indicator";

interface EditorSidebarProps {
  status: ChapterStatus;
  onStatusChange: (next: ChapterStatus) => void;
  /** Estado do autosave, exibido logo abaixo do botão de status. */
  saveStatus: SaveStatus;
  dirty: boolean;
  savedAt: string | null;
  onBookmarks: () => void;
  onRead: () => void;
  onStructure: () => void;
  onShare: () => void;
  onVersions: () => void;
  revealGrifar: boolean;
  onToggleRevealGrifar: () => void;
  onInsertImage: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onReview: () => void;
}

/**
 * Sidebar flutuante vertical à direita do editor. Reúne as ações do capítulo
 * e as de escrita que antes viviam em barras horizontais. Minimizada, desliza
 * para fora da tela e deixa uma aba na borda direita para reabrir.
 */
export function EditorSidebar({
  status,
  onStatusChange,
  saveStatus,
  dirty,
  savedAt,
  onBookmarks,
  onRead,
  onStructure,
  onShare,
  onVersions,
  revealGrifar,
  onToggleRevealGrifar,
  onInsertImage,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onReview,
}: EditorSidebarProps) {
  const collapsed = useUiStore((state) => state.editorSidebarCollapsed);
  const setCollapsed = useUiStore((state) => state.setEditorSidebarCollapsed);

  const action = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    options?: { active?: boolean; disabled?: boolean },
  ) => (
    <Button
      type="button"
      variant={options?.active ? "secondary" : "ghost"}
      size="icon"
      className="size-9 rounded-full"
      aria-label={label}
      aria-pressed={options?.active}
      disabled={options?.disabled}
      onClick={onClick}
    >
      {icon}
    </Button>
  );

  return (
    <aside
        data-slot="editor-sidebar"
        aria-label="Ações do capítulo"
        aria-hidden={collapsed}
        inert={collapsed}
        className={cn(
          "fixed top-1/2 right-1 z-20 -translate-y-1/2",
          "flex flex-col items-center gap-0.5 rounded-full border border-border/70 bg-background/85 p-1 shadow-lg backdrop-blur-xl",
          // `translate` é a propriedade que o Tailwind v4 move; `visibility`
          // troca só depois do slide (0s de duração + atraso), para o
          // fora-da-tela não ficar focável nem vazar na página. Sem
          // `motion-reduce:transition-none`: quem controla animação é o
          // toggle de Configurações (data-animations), não o SO.
          "md:right-3",
          collapsed
            ? "invisible pointer-events-none translate-x-[calc(100%+1.5rem)] opacity-0 [transition:translate_300ms_cubic-bezier(0.22,1,0.36,1),opacity_300ms_linear,visibility_0s_300ms]"
            : "visible translate-x-0 opacity-100 [transition:translate_300ms_cubic-bezier(0.22,1,0.36,1),opacity_300ms_linear]",
        )}
      >
        {action(
          "Minimizar ações do capítulo",
          <PanelRightClose aria-hidden className="size-4" />,
          () => setCollapsed(true),
        )}
        {/* Status do capítulo: um ponto colorido abre o sub-menu. */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 rounded-full"
              aria-label={`Status do capítulo: ${CHAPTER_STATUS_LABELS[status]}`}
              title={`Status: ${CHAPTER_STATUS_LABELS[status]}`}
            >
              <span
                aria-hidden
                className={cn("size-2.5 rounded-full", CHAPTER_STATUS_DOT[status])}
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="left" align="center" className="w-40">
            {Object.entries(CHAPTER_STATUS_LABELS).map(([value, label]) => (
              <DropdownMenuItem
                key={value}
                onSelect={() => onStatusChange(value as ChapterStatus)}
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-2 rounded-full",
                    CHAPTER_STATUS_DOT[value as ChapterStatus],
                  )}
                />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <SaveStatusIndicator
          status={saveStatus}
          dirty={dirty}
          savedAt={savedAt}
        />
        <span aria-hidden className="my-0.5 h-px w-5 bg-border/70" />
        {action("Ler capítulo", <BookOpen aria-hidden className="size-4" />, onRead)}
        {action(
          "Visualizar estrutura",
          <ListTree aria-hidden className="size-4" />,
          onStructure,
        )}
        {action(
          "Compartilhar capítulo",
          <Share2 aria-hidden className="size-4" />,
          onShare,
        )}
        {action(
          "Versões anteriores",
          <History aria-hidden className="size-4" />,
          onVersions,
        )}
        {action(
          "Marcadores",
          <Bookmark aria-hidden className="size-4" />,
          onBookmarks,
        )}
        {action(
          "Revelar grifados",
          <Eye aria-hidden className="size-4" />,
          onToggleRevealGrifar,
          { active: revealGrifar },
        )}
        {action(
          "Inserir imagem",
          <ImagePlus aria-hidden className="size-4" />,
          onInsertImage,
        )}
        <span aria-hidden className="my-0.5 h-px w-5 bg-border/70" />
        {action("Desfazer", <Undo2 aria-hidden className="size-4" />, onUndo, {
          disabled: !canUndo,
        })}
        {action("Refazer", <Redo2 aria-hidden className="size-4" />, onRedo, {
          disabled: !canRedo,
        })}
        <span aria-hidden className="my-0.5 h-px w-5 bg-border/70" />
        {action("Revisar", <SpellCheck2 aria-hidden className="size-4" />, onReview)}
      </aside>
  );
}
