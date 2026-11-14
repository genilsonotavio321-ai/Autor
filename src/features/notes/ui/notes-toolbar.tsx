"use client";

import { useRef, useState, type ChangeEvent } from "react";
import {
  ArrowUpDown,
  FileDown,
  FileUp,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NewFolderButton } from "@/features/folders/ui/new-folder-button";
import type { EntityId, Folder } from "@/shared/types/database";

import { NOTES_SORT_LABELS, type NotesSort } from "../domain/sort";
import { importNotesFile } from "../infra/notes-import";

interface NotesToolbarProps {
  projectId: EntityId | null;
  noteCount: number;
  sort: NotesSort;
  onSortChange: (sort: NotesSort) => void;
  openFolderId: EntityId | null;
  onFolderCreated: (folder: Folder) => void;
  /** Abre o diálogo de formato para exportar todas as notas visíveis. */
  onExportAll: () => void;
  /** Já confirmado pelo AlertDialog interno: move todas para a lixeira. */
  onClearAll: () => void;
  onNewNote: () => void;
}

/** Ações do cabeçalho da página de notas (criar pasta, ordenar, importar/exportar). */
export function NotesToolbar({
  projectId,
  noteCount,
  sort,
  onSortChange,
  openFolderId,
  onFolderCreated,
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
        toast.error("Nenhuma nota encontrada no arquivo.");
        return;
      }
      toast.success(
        created === 1 ? "1 nota importada" : `${created} notas importadas`,
      );
    } catch {
      toast.error("Falha ao importar as notas.");
    }
  }

  return (
    <>
      <NewFolderButton
        kind="note"
        projectId={projectId}
        parentId={openFolderId ?? undefined}
        onCreated={onFolderCreated}
      />
      <Select value={sort} onValueChange={(value) => onSortChange(value as NotesSort)}>
        <SelectTrigger className="w-52" aria-label="Ordenar notas">
          <ArrowUpDown aria-hidden className="size-4" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(NOTES_SORT_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Mais opções de notas">
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={noteCount === 0} onSelect={onExportAll}>
            <FileDown aria-hidden />
            Exportar notas
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!projectId}
            onSelect={() => {
              // Abre o seletor após o menu fechar (evita corrida de foco).
              window.setTimeout(() => importInputRef.current?.click(), 0);
            }}
          >
            <FileUp aria-hidden />
            Importar notas
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={noteCount === 0}
            onSelect={() => setClearOpen(true)}
          >
            <Trash2 aria-hidden />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
      <Button onClick={onNewNote} disabled={!projectId}>
        <Plus aria-hidden />
        Nova nota
      </Button>
    </>
  );
}
