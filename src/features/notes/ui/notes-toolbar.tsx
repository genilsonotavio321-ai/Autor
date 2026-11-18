"use client";

import { useRef, useState, type ChangeEvent } from "react";
import {
  ArrowUpDown,
  Check,
  Download,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NewFolderButton } from "@/features/folders/ui/new-folder-button";
import type { EntityId } from "@/shared/types/database";

import { NOTES_SORT_LABELS, type NotesSort } from "../domain/sort";
import { importNotesFile } from "../infra/notes-import";

interface NotesToolbarProps {
  projectId: EntityId | null;
  noteCount: number;
  sort: NotesSort;
  onSortChange: (sort: NotesSort) => void;
  openFolderId: EntityId | null;
  /** Abre o diálogo de formato para exportar todas as notas visíveis. */
  onExportAll: () => void;
  /** Já confirmado pelo AlertDialog interno: move todas para a lixeira. */
  onClearAll: () => void;
  onNewNote: () => void;
}

/**
 * Ações da página de notas, todas em ícones na sub-barra flutuante: nova nota,
 * nova pasta, ordenação, exportar, importar e excluir todas.
 */
export function NotesToolbar({
  projectId,
  noteCount,
  sort,
  onSortChange,
  openFolderId,
  onExportAll,
  onClearAll,
  onNewNote,
}: NotesToolbarProps) {
  const [clearOpen, setClearOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !projectId) return;
    try {
      const text = await file.text();
      const { created } = await importNotesFile(projectId, file.name, text);
      if (created === 0) {
        return;
      }
    } catch {
    }
  }

  return (
    <>
      <NewFolderButton
        kind="note"
        projectId={projectId}
        parentId={openFolderId ?? undefined}
      />
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="rounded-full"
            aria-label={`Ordenar notas — ${NOTES_SORT_LABELS[sort]}`}
            title={`Ordenar: ${NOTES_SORT_LABELS[sort]}`}
          >
            <ArrowUpDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {Object.entries(NOTES_SORT_LABELS).map(([value, label]) => (
            <DropdownMenuItem
              key={value}
              onSelect={() => onSortChange(value as NotesSort)}
            >
              {value === sort ? (
                <Check aria-hidden />
              ) : (
                <span aria-hidden className="size-4" />
              )}
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="outline"
        size="icon"
        className="rounded-full"
        aria-label="Exportar notas"
        title="Exportar notas"
        disabled={noteCount === 0}
        onClick={onExportAll}
      >
        <Upload aria-hidden />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="rounded-full"
        aria-label="Importar notas"
        title="Importar notas"
        disabled={!projectId}
        onClick={() => importInputRef.current?.click()}
      >
        <Download aria-hidden />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="rounded-full text-destructive"
        aria-label="Excluir todas as notas"
        title="Excluir todas as notas"
        disabled={noteCount === 0}
        onClick={() => setClearOpen(true)}
      >
        <Trash2 aria-hidden />
      </Button>
      <Button
        size="icon"
        className="rounded-full"
        aria-label="Nova nota"
        title="Nova nota"
        onClick={onNewNote}
        disabled={!projectId}
      >
        <Plus aria-hidden />
      </Button>

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir todas as notas?</AlertDialogTitle>
            <AlertDialogDescription>
              {noteCount} {noteCount === 1 ? "nota será movida" : "notas serão movidas"}{" "}
              para a lixeira. Você pode restaurá-las na Lixeira.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => onClearAll()}>
              Excluir todas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <input
        ref={importInputRef}
        type="file"
        accept=".md,.txt,text/markdown,text/plain"
        className="hidden"
        onChange={(event) => void handleImportFile(event)}
      />
    </>
  );
}
