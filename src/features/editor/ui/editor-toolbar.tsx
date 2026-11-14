"use client";

import {
  BookOpen,
  History,
  ListTree,
  Maximize2,
  Minimize2,
  Share2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CHAPTER_STATUS_COLORS,
  CHAPTER_STATUS_DOT,
  CHAPTER_STATUS_LABELS,
} from "@/features/projects/domain/repository";
import type { ChapterStatus } from "@/shared/types/database";

function focusLabel(focusMode: boolean) {
  return focusMode ? "Sair do modo foco" : "Ativar modo foco (Esc para sair)";
}

interface ChapterStatusSelectProps {
  value: ChapterStatus;
  onChange: (next: ChapterStatus) => void;
  /** Compacto é a variante de dentro do editor (layout simplificado). */
  compact?: boolean;
}

function ChapterStatusSelect({
  value,
  onChange,
  compact = false,
}: ChapterStatusSelectProps) {
  const size = compact ? "h-8 w-32" : "h-9 w-36";
  return (
    <Select value={value} onValueChange={(next) => onChange(next as ChapterStatus)}>
      <SelectTrigger
        className={`${size} gap-2 ${CHAPTER_STATUS_COLORS[value]}`}
        aria-label="Status do capítulo"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(CHAPTER_STATUS_LABELS).map(([item, label]) => (
          <SelectItem key={item} value={item}>
            <span
              aria-hidden
              className={`size-2 rounded-full ${CHAPTER_STATUS_DOT[item as ChapterStatus]}`}
            />
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export interface EditorToolbarProps {
  status: ChapterStatus;
  onChangeStatus: (next: ChapterStatus) => void;
  onRead: () => void;
  onScenes: () => void;
  onVersions: () => void;
  onShare: () => void;
  focusMode: boolean;
  onToggleFocus: () => void;
}

/** Botões de ação compactos, dentro do editor (layout simplificado). */
export function EditorActionsCompact({
  status,
  onChangeStatus,
  onRead,
  onScenes,
  onVersions,
  onShare,
  focusMode,
  onToggleFocus,
}: EditorToolbarProps) {
  return (
    <>
      <ChapterStatusSelect compact value={status} onChange={onChangeStatus} />
      <Button
        variant="outline"
        size="icon"
        className="size-8"
        aria-label="Ler capítulo"
        onClick={onRead}
      >
        <BookOpen aria-hidden className="size-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="size-8"
        aria-label="Ver cenas"
        onClick={onScenes}
      >
        <ListTree aria-hidden className="size-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="size-8"
        aria-label="Versões"
        onClick={onVersions}
      >
        <History aria-hidden className="size-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="size-8"
        aria-label="Compartilhar"
        onClick={onShare}
      >
        <Share2 aria-hidden className="size-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="size-8"
        onClick={onToggleFocus}
        aria-label={focusLabel(focusMode)}
      >
        {focusMode ? (
          <Minimize2 aria-hidden className="size-4" />
        ) : (
          <Maximize2 aria-hidden className="size-4" />
        )}
      </Button>
    </>
  );
}

/** Linha de ações normal, abaixo do título do capítulo. */
export function EditorToolbar({
  status,
  onChangeStatus,
  onRead,
  onScenes,
  onVersions,
  onShare,
  focusMode,
  onToggleFocus,
}: EditorToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ChapterStatusSelect value={status} onChange={onChangeStatus} />
      <Button variant="outline" size="sm" className="h-9" onClick={onRead}>
        <BookOpen aria-hidden />
        Ler
      </Button>
      <Button variant="outline" size="sm" className="h-9" onClick={onScenes}>
        <ListTree aria-hidden />
        Cenas
      </Button>
      <Button variant="outline" size="sm" className="h-9" onClick={onVersions}>
        <History aria-hidden />
        Versões
      </Button>
      <Button variant="outline" size="sm" className="h-9" onClick={onShare}>
        <Share2 aria-hidden />
        Compartilhar
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="size-9"
        onClick={onToggleFocus}
        aria-label={focusLabel(focusMode)}
      >
        {focusMode ? (
          <Minimize2 aria-hidden className="size-4" />
        ) : (
          <Maximize2 aria-hidden className="size-4" />
        )}
      </Button>
    </div>
  );
}
