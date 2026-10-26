"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Folder as FolderIcon, Pencil, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Folder } from "@/shared/types/database";

interface FolderCardProps {
  folder: Folder;
  /** Fichas + pastas filhas diretas (badge de contagem). */
  count: number;
  suppressClick: RefObject<boolean>;
  onOpen: (folder: Folder) => void;
  onRename: (folder: Folder, name: string) => void;
  onDelete: (folder: Folder) => void;
}

export function FolderCard({
  folder,
  count,
  suppressClick,
  onOpen,
  onRename,
  onDelete,
}: FolderCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: folder.id });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(folder.name);
  }, [folder.name]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function open() {
    if (suppressClick.current) return;
    onOpen(folder);
  }

  function commitRename() {
    setEditing(false);
    const trimmed = name.trim();
    if (!trimmed || trimmed === folder.name) {
      setName(folder.name);
      return;
    }
    onRename(folder, trimmed);
  }

  const stop = (event: React.SyntheticEvent) => event.stopPropagation();

  return (
    <li
      ref={setNodeRef}
      // Congela o "abre espaço" do sortable: só o card arrastado se move,
      // o alvo não foge do ponteiro (soltar no centro vira fácil).
      style={{
        transform: isDragging ? CSS.Transform.toString(transform) : undefined,
        transition,
      }}
      data-dragging={isDragging || undefined}
      {...attributes}
      {...listeners}
      onClick={open}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      }}
      className={`flex cursor-pointer touch-none select-none flex-col rounded-lg border bg-card p-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
        isDragging ? "opacity-60" : ""
      } ${isOver ? "ring-2 ring-primary" : ""}`}
    >
      <div className="mb-2 flex items-start gap-2">
        <FolderIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        {editing ? (
          <Input
            ref={inputRef}
            value={name}
            aria-label="Nome da pasta"
            className="h-7"
            onChange={(event) => setName(event.target.value)}
            onPointerDown={stop}
            onClick={stop}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitRename();
              if (event.key === "Escape") {
                setName(folder.name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            onPointerDown={stop}
            onClick={(event) => {
              stop(event);
              open();
            }}
            className="min-w-0 flex-1 text-left font-medium hover:underline"
          >
            {folder.name}
          </button>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Renomear ${folder.name}`}
          onPointerDown={stop}
          onClick={(event) => {
            stop(event);
            setEditing(true);
          }}
        >
          <Pencil aria-hidden />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Excluir ${folder.name}`}
              onPointerDown={stop}
              onClick={stop}
            >
              <Trash2 aria-hidden />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Excluir a pasta “{folder.name}”?
              </AlertDialogTitle>
              <AlertDialogDescription>
                A pasta e tudo dentro dela — inclusive pastas aninhadas — vai
                para a lixeira. Você pode desfazer na Lixeira.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(folder)}>
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <Badge variant="secondary" className="w-fit">
        {count} {count === 1 ? "item" : "itens"}
      </Badge>
      <span className="mt-auto pt-3 text-xs text-muted-foreground">
        pasta · arraste um card até aqui para guardar dentro
      </span>
    </li>
  );
}
